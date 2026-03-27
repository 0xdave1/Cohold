import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { P2PTransferDto } from './dto/p2p-transfer.dto';
import { toDecimal, formatMoney } from '../../common/money/decimal.util';
import { fixMoney, moneyStr } from '../../common/money/precision.constants';
import { TransactionDirection, TransactionStatus, TransactionType } from '@prisma/client';

@Injectable()
export class TransferService {
  constructor(private readonly prisma: PrismaService) {}

  async p2pTransfer(senderId: string, dto: P2PTransferDto) {
    if (!dto.recipientHandle.startsWith('@')) {
      throw new BadRequestException('Recipient handle must start with @');
    }

    const username = dto.recipientHandle.slice(1);
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

    const amount = fixMoney(toDecimal(dto.amount));
    if (amount.lte(0)) {
      throw new BadRequestException('Amount must be positive');
    }

    // For MVP, use NGN wallet; extend to support multi-currency routing.
    const [senderWallet, recipientWallet] = await Promise.all([
      this.prisma.wallet.findFirst({
        where: { userId: sender.id },
      }),
      this.prisma.wallet.findFirst({
        where: { userId: recipient.id },
      }),
    ]);

    if (!senderWallet || !recipientWallet) {
      throw new BadRequestException('Both users must have wallets');
    }

    if (senderWallet.currency !== recipientWallet.currency) {
      throw new BadRequestException('P2P transfer requires same-currency wallets for now');
    }

    const senderBalance = toDecimal(senderWallet.balance.toString());
    if (senderBalance.lt(amount)) {
      throw new BadRequestException('Insufficient balance');
    }

    const baseRef = dto.clientReference ?? `P2P-${Date.now()}-${senderId}`;

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedSenderWallet = await tx.wallet.update({
        where: { id: senderWallet.id },
        data: {
          balance: moneyStr(fixMoney(senderBalance.minus(amount))),
        },
      });

      const updatedRecipientWallet = await tx.wallet.update({
        where: { id: recipientWallet.id },
        data: {
          balance: moneyStr(fixMoney(toDecimal(recipientWallet.balance.toString()).plus(amount))),
        },
      });

      await tx.transaction.createMany({
        data: [
          {
            walletId: senderWallet.id,
            userId: sender.id,
            reference: `${baseRef}-DEBIT`,
            groupId: baseRef,
            externalReference: null,
            type: TransactionType.P2P_TRANSFER,
            status: TransactionStatus.COMPLETED,
            amount: moneyStr(amount),
            currency: senderWallet.currency,
            direction: TransactionDirection.DEBIT,
            metadata: {
              recipientId: recipient.id,
              recipientHandle: dto.recipientHandle,
              groupId: baseRef,
            },
          },
          {
            walletId: recipientWallet.id,
            userId: recipient.id,
            reference: `${baseRef}-CREDIT`,
            groupId: baseRef,
            externalReference: null,
            type: TransactionType.P2P_TRANSFER,
            status: TransactionStatus.COMPLETED,
            amount: moneyStr(amount),
            currency: recipientWallet.currency,
            direction: TransactionDirection.CREDIT,
            metadata: {
              senderId: sender.id,
              senderUsername: sender.username,
              groupId: baseRef,
            },
          },
        ],
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

