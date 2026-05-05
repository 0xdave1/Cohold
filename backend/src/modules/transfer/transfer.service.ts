import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { P2PTransferDto } from './dto/p2p-transfer.dto';
import { toDecimal, formatMoney } from '../../common/money/decimal.util';
import { fixMoney, moneyStr } from '../../common/money/precision.constants';
import { Currency, LedgerOperationType, Prisma, TransactionDirection, TransactionType } from '@prisma/client';
import { normalizeUsername } from '../../common/username/username.util';
import { P2PExecuteDto } from './dto/p2p-execute.dto';
import { P2PPreviewDto } from './dto/p2p-preview.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { SUPPORTED_CURRENCIES } from '../../common/constants/currency.constants';
import { WalletService } from '../wallet/wallet.service';
import { KycPolicyService } from '../kyc/kyc-policy.service';

@Injectable()
export class TransferService {
  private readonly logger = new Logger(TransferService.name);
  private readonly transferCurrency = SUPPORTED_CURRENCIES[0];

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly walletService: WalletService,
    private readonly kycPolicy: KycPolicyService,
  ) {}

  private async assertUserHasUsername(userId: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { username: true } });
    if (!u) throw new NotFoundException('User not found');
    if (!u.username) {
      throw new BadRequestException({ code: 'USERNAME_REQUIRED', message: 'Username is required to use P2P' });
    }
    return u.username;
  }

  async searchRecipients(senderId: string, query: string) {
    await this.assertUserHasUsername(senderId);

    const q = normalizeUsername(query);
    if (q.length < 2) {
      return { items: [] as Array<{ id: string; username: string; displayName: string | null }> };
    }

    const prefix = await this.prisma.user.findMany({
      where: {
        id: { not: senderId },
        username: { not: null, startsWith: q },
        isFrozen: false,
      },
      take: 10,
      select: { id: true, username: true, firstName: true, lastName: true },
      orderBy: { username: 'asc' },
    });

    const contains =
      prefix.length >= 10
        ? []
        : await this.prisma.user.findMany({
            where: {
              id: { not: senderId },
              username: { not: null, contains: q },
              isFrozen: false,
              NOT: { id: { in: prefix.map((p) => p.id) } },
            },
            take: 10 - prefix.length,
            select: { id: true, username: true, firstName: true, lastName: true },
            orderBy: { username: 'asc' },
          });

    const items = [...prefix, ...contains].map((u) => ({
      id: u.id,
      username: u.username!,
      displayName: [u.firstName, u.lastName].filter(Boolean).join(' ') || null,
    }));
    return { items };
  }

  async preview(senderId: string, dto: P2PPreviewDto) {
    await this.kycPolicy.assertUserKycVerifiedForMoneyMovement(senderId);
    await this.kycPolicy.assertUserKycVerifiedForMoneyMovement(dto.recipientUserId);
    await this.assertUserHasUsername(senderId);
    if (dto.currency !== this.transferCurrency) {
      throw new BadRequestException('Only NGN transfers are supported for now');
    }

    if (dto.recipientUserId === senderId) {
      throw new BadRequestException('Cannot transfer to yourself');
    }

    const amount = fixMoney(toDecimal(dto.amount));
    if (amount.lte(0)) throw new BadRequestException('Amount must be positive');

    const [recipient, senderWallet, recipientWallet] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: dto.recipientUserId },
        select: { id: true, username: true, firstName: true, lastName: true, isFrozen: true },
      }),
      this.prisma.wallet.findUnique({
        where: { userId_currency: { userId: senderId, currency: this.transferCurrency } },
      }),
      this.prisma.wallet.findUnique({
        where: { userId_currency: { userId: dto.recipientUserId, currency: this.transferCurrency } },
      }),
    ]);

    if (!recipient || recipient.isFrozen || !recipient.username) {
      throw new NotFoundException('Recipient not found');
    }
    if (!senderWallet) throw new BadRequestException('Sender wallet not found for currency');
    if (!recipientWallet) throw new BadRequestException('Recipient wallet not found for currency');

    const fee = fixMoney(toDecimal('0'));
    const recipientAmount = fixMoney(amount.minus(fee));
    if (recipientAmount.lte(0)) throw new BadRequestException('Amount too small');

    return {
      currency: this.transferCurrency,
      amount: formatMoney(amount),
      fee: formatMoney(fee),
      recipientAmount: formatMoney(recipientAmount),
      recipient: {
        id: recipient.id,
        username: recipient.username,
        displayName: [recipient.firstName, recipient.lastName].filter(Boolean).join(' ') || null,
      },
      senderBalance: formatMoney(toDecimal(senderWallet.balance.toString())),
    };
  }

  async execute(senderId: string, dto: P2PExecuteDto) {
    await this.kycPolicy.assertUserKycVerifiedForMoneyMovement(senderId);
    await this.kycPolicy.assertUserKycVerifiedForMoneyMovement(dto.recipientUserId);
    const senderUsername = await this.assertUserHasUsername(senderId);
    if (dto.currency !== this.transferCurrency) {
      throw new BadRequestException('Only NGN transfers are supported for now');
    }

    if (dto.recipientUserId === senderId) {
      throw new BadRequestException('Cannot transfer to yourself');
    }

    const amount = fixMoney(toDecimal(dto.amount));
    if (amount.lte(0)) throw new BadRequestException('Amount must be positive');

    // Idempotency: return existing receipt if already executed by same sender+key.
    const existing = await this.prisma.p2PTransfer.findUnique({
      where: { senderId_idempotencyKey: { senderId, idempotencyKey: dto.idempotencyKey } },
      include: {
        recipient: { select: { id: true, username: true, firstName: true, lastName: true } },
      },
    });
    if (existing) {
      return this.formatTransferReceipt(existing);
    }

    const recipient = await this.prisma.user.findUnique({
      where: { id: dto.recipientUserId },
      select: { id: true, username: true, isFrozen: true, firstName: true, lastName: true },
    });
    if (!recipient || recipient.isFrozen || !recipient.username) {
      throw new NotFoundException('Recipient not found');
    }

    const [senderWallet, recipientWallet] = await Promise.all([
      this.prisma.wallet.findUnique({
        where: { userId_currency: { userId: senderId, currency: this.transferCurrency } },
      }),
      this.prisma.wallet.findUnique({
        where: { userId_currency: { userId: dto.recipientUserId, currency: this.transferCurrency } },
      }),
    ]);
    if (!senderWallet) throw new BadRequestException('Sender wallet not found for currency');
    if (!recipientWallet) throw new BadRequestException('Recipient wallet not found for currency');

    const fee = fixMoney(toDecimal('0'));
    const recipientAmount = fixMoney(amount.minus(fee));
    if (recipientAmount.lte(0)) throw new BadRequestException('Amount too small');

    const groupId = `P2P-${dto.idempotencyKey}`;

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        // Lock wallets in deterministic order to avoid deadlocks.
        const ids = [senderWallet.id, recipientWallet.id].sort();
        await tx.$queryRawUnsafe(`SELECT id FROM "Wallet" WHERE id = $1 FOR UPDATE`, ids[0]);
        if (ids[1] !== ids[0]) {
          await tx.$queryRawUnsafe(`SELECT id FROM "Wallet" WHERE id = $1 FOR UPDATE`, ids[1]);
        }

        const lockedSender = await tx.wallet.findUniqueOrThrow({ where: { id: senderWallet.id } });
        const lockedRecipient = await tx.wallet.findUniqueOrThrow({ where: { id: recipientWallet.id } });

        const senderBal = toDecimal(lockedSender.balance.toString());
        if (senderBal.lt(amount)) {
          throw new BadRequestException('Insufficient balance');
        }

        const transfer = await tx.p2PTransfer.create({
          data: {
            senderId,
            recipientId: recipient.id,
            currency: this.transferCurrency,
            amount: moneyStr(amount),
            fee: moneyStr(fee),
            recipientAmount: moneyStr(recipientAmount),
            note: dto.note ?? null,
            idempotencyKey: dto.idempotencyKey,
            groupId,
          },
          include: {
            recipient: { select: { id: true, username: true, firstName: true, lastName: true } },
          },
        });

        const senderMeta: Prisma.InputJsonValue = {
          recipientId: recipient.id,
          recipientUsername: recipient.username,
          note: dto.note ?? null,
          groupId,
        };
        const recipientMeta: Prisma.InputJsonValue = {
          senderId,
          senderUsername,
          note: dto.note ?? null,
          groupId,
        };
        await this.walletService.postDoubleEntry(tx, groupId, [
          {
            walletId: lockedSender.id,
            userId: senderId,
            type: TransactionType.P2P_TRANSFER,
            direction: TransactionDirection.DEBIT,
            amount: amount,
            currency: this.transferCurrency,
            fee: fee,
            netAmount: recipientAmount,
            metadata: senderMeta,
          },
          {
            walletId: lockedRecipient.id,
            userId: recipient.id,
            type: TransactionType.P2P_TRANSFER,
            direction: TransactionDirection.CREDIT,
            amount: amount,
            currency: this.transferCurrency,
            netAmount: recipientAmount,
            metadata: recipientMeta,
          },
        ], {
          operationType: LedgerOperationType.TRANSFER,
          sourceModule: 'transfer.executeP2PTransfer',
          sourceId: transfer.id,
        });

        return transfer;
      });

      // Non-blocking post-success notification for recipient.
      try {
        await this.notificationsService.notifyIncomingP2PReceived(
          recipient.id,
          formatMoney(amount),
          this.transferCurrency,
          senderUsername,
          created.id,
        );
      } catch (notifyErr) {
        this.logger.warn(
          `Failed incoming P2P notification transferId=${created.id} recipient=${recipient.id}: ${notifyErr}`,
        );
      }
      try {
        await this.notificationsService.notifyOutgoingP2PSent(
          senderId,
          formatMoney(amount),
          this.transferCurrency,
          recipient.username,
          created.id,
        );
      } catch (notifyErr) {
        this.logger.warn(
          `Failed outgoing P2P notification transferId=${created.id} sender=${senderId}: ${notifyErr}`,
        );
      }

      return this.formatTransferReceipt(created);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        // Race on unique constraints (idempotency or groupId)
        throw new ConflictException({ code: 'DUPLICATE_REQUEST', message: 'Duplicate transfer request' });
      }
      throw err;
    }
  }

  async history(userId: string, params: { page?: number; limit?: number }) {
    await this.assertUserHasUsername(userId);
    const page = params.page && params.page > 0 ? params.page : 1;
    const limit = params.limit && params.limit > 0 ? Math.min(params.limit, 50) : 20;
    const skip = (page - 1) * limit;

    const where: Prisma.P2PTransferWhereInput = {
      OR: [{ senderId: userId }, { recipientId: userId }],
    };

    const [items, total] = await Promise.all([
      this.prisma.p2PTransfer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          sender: { select: { id: true, username: true, firstName: true, lastName: true } },
          recipient: { select: { id: true, username: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.p2PTransfer.count({ where }),
    ]);

    return {
      items: items.map((t) => this.formatTransferReceipt(t)),
      meta: { page, limit, total },
    };
  }

  async getById(userId: string, id: string) {
    await this.assertUserHasUsername(userId);
    const t = await this.prisma.p2PTransfer.findUnique({
      where: { id },
      include: {
        sender: { select: { id: true, username: true, firstName: true, lastName: true } },
        recipient: { select: { id: true, username: true, firstName: true, lastName: true } },
      },
    });
    if (!t || (t.senderId !== userId && t.recipientId !== userId)) {
      throw new NotFoundException('Transfer not found');
    }
    return this.formatTransferReceipt(t);
  }

  private formatTransferReceipt(t: any) {
    return {
      id: t.id,
      groupId: t.groupId,
      currency: t.currency as Currency,
      amount: formatMoney(toDecimal(t.amount.toString())),
      fee: formatMoney(toDecimal(t.fee.toString())),
      recipientAmount: formatMoney(toDecimal(t.recipientAmount.toString())),
      note: t.note ?? null,
      sender: t.sender
        ? {
            id: t.sender.id,
            username: t.sender.username,
            displayName: [t.sender.firstName, t.sender.lastName].filter(Boolean).join(' ') || null,
          }
        : undefined,
      recipient: t.recipient
        ? {
            id: t.recipient.id,
            username: t.recipient.username,
            displayName: [t.recipient.firstName, t.recipient.lastName].filter(Boolean).join(' ') || null,
          }
        : undefined,
      createdAt: t.createdAt,
    };
  }

  async p2pTransfer(senderId: string, dto: P2PTransferDto) {
    await this.kycPolicy.assertUserKycVerifiedForMoneyMovement(senderId);

    if (!dto.recipientHandle.startsWith('@')) {
      throw new BadRequestException('Recipient handle must start with @');
    }

    const username = normalizeUsername(dto.recipientHandle);
    const [sender, recipient] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: senderId } }),
      this.prisma.user.findUnique({ where: { username } }),
    ]);

    if (!sender) {
      throw new NotFoundException('Sender not found');
    }
    if (!recipient) {
      throw new NotFoundException('Recipient not found');
    }
    if (!sender.username) {
      throw new BadRequestException({ code: 'USERNAME_REQUIRED', message: 'Username is required to use P2P' });
    }
    if (!recipient.username) {
      throw new NotFoundException('Recipient not found');
    }
    if (sender.id === recipient.id) {
      throw new BadRequestException('Cannot transfer to yourself');
    }

    await this.kycPolicy.assertUserKycVerifiedForMoneyMovement(recipient.id);

    const amount = fixMoney(toDecimal(dto.amount));
    if (amount.lte(0)) {
      throw new BadRequestException('Amount must be positive');
    }

    // Backward-compatible endpoint: preserve legacy behavior (first wallet) while enforcing username.
    const [senderWallet, recipientWallet] = await Promise.all([
      this.prisma.wallet.findUnique({
        where: { userId_currency: { userId: sender.id, currency: this.transferCurrency } },
      }),
      this.prisma.wallet.findUnique({
        where: { userId_currency: { userId: recipient.id, currency: this.transferCurrency } },
      }),
    ]);

    if (!senderWallet || !recipientWallet) {
      throw new BadRequestException('Both users must have wallets');
    }

    const senderBalance = toDecimal(senderWallet.balance.toString());
    if (senderBalance.lt(amount)) {
      throw new BadRequestException('Insufficient balance');
    }

    const baseRef = dto.clientReference ?? `P2P-${Date.now()}-${senderId}`;

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe(`SELECT id FROM "Wallet" WHERE id = $1 FOR UPDATE`, senderWallet.id);
      await tx.$queryRawUnsafe(`SELECT id FROM "Wallet" WHERE id = $1 FOR UPDATE`, recipientWallet.id);

      await this.walletService.postDoubleEntry(tx, baseRef, [
        {
          walletId: senderWallet.id,
          userId: sender.id,
          type: TransactionType.P2P_TRANSFER,
          direction: TransactionDirection.DEBIT,
          amount: amount,
          currency: senderWallet.currency,
          metadata: {
            recipientId: recipient.id,
            recipientHandle: dto.recipientHandle,
            groupId: baseRef,
          } as Prisma.InputJsonValue,
        },
        {
          walletId: recipientWallet.id,
          userId: recipient.id,
          type: TransactionType.P2P_TRANSFER,
          direction: TransactionDirection.CREDIT,
          amount: amount,
          currency: recipientWallet.currency,
          metadata: {
            senderId: sender.id,
            senderUsername: sender.username,
            groupId: baseRef,
          } as Prisma.InputJsonValue,
        },
      ], {
        operationType: LedgerOperationType.TRANSFER,
        sourceModule: 'transfer.p2pTransfer',
        sourceId: baseRef,
      });

      const updatedSenderWallet = await tx.wallet.findUniqueOrThrow({ where: { id: senderWallet.id } });
      const updatedRecipientWallet = await tx.wallet.findUniqueOrThrow({
        where: { id: recipientWallet.id },
      });

      return {
        updatedSenderWallet,
        updatedRecipientWallet,
      };
    });

    return {
      fromUserId: sender.id,
      toUserId: recipient.id,
      amount: formatMoney(amount),
      currency: senderWallet.currency,
      before: {
        senderBalance: formatMoney(senderBalance),
        recipientBalance: formatMoney(toDecimal(recipientWallet.balance.toString())),
      },
      after: {
        senderBalance: formatMoney(toDecimal(result.updatedSenderWallet.balance.toString())),
        recipientBalance: formatMoney(toDecimal(result.updatedRecipientWallet.balance.toString())),
      },
    };
  }
}

