import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { PersonalDetailsDto } from './dto/personal-details.dto';
import { ResidentialDetailsDto } from './dto/residential-details.dto';
import { AddLinkedBankDto } from './dto/add-linked-bank.dto';
import { assertValidUsername, normalizeUsername, validateUsername } from '../../common/username/username.util';
import { Currency, Prisma } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        emailVerifiedAt: true,
        username: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        phoneCountryCode: true,
        nationality: true,
        houseNumber: true,
        streetName: true,
        city: true,
        state: true,
        kycStatus: true,
        onboardingCompletedAt: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      ...user,
      requiresUsernameSetup: user.username == null,
    };
  }

  async checkUsernameAvailability(usernameInput: string) {
    const v = validateUsername(usernameInput);
    if (!v.ok) {
      return {
        available: false,
        normalizedUsername: normalizeUsername(usernameInput),
        reason: v.code,
      };
    }

    const existing = await this.prisma.user.findUnique({
      where: { username: v.normalized },
      select: { id: true },
    });

    return {
      available: !existing,
      normalizedUsername: v.normalized,
      reason: existing ? 'USERNAME_TAKEN' : null,
    };
  }

  /**
   * Strict, production-safe policy:
   * - legacy users with null username may set it once
   * - once set, username cannot be changed (until a dedicated, audited rename flow exists)
   */
  async setUsername(userId: string, usernameInput: string) {
    const normalized = assertValidUsername(usernameInput);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.username) {
      throw new BadRequestException({
        code: 'USERNAME_INVALID',
        message: 'Username is already set and cannot be changed at this time',
      });
    }

    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { username: normalized },
      });
    } catch (err) {
      // Unique constraint race
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException({ code: 'USERNAME_TAKEN', message: 'Username is taken' });
      }
      throw err;
    }

    return this.getMe(userId);
  }

  async updateMe(userId: string, dto: UpdateProfileDto) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        phoneCountryCode: dto.phoneCountryCode,
        phoneNumber: dto.phoneNumber,
        nationality: dto.nationality,
        houseNumber: dto.houseNumber,
        streetName: dto.streetName,
        city: dto.city,
        state: dto.state,
      },
    });
    return this.getMe(userId);
  }

  async updatePersonalDetails(userId: string, dto: PersonalDetailsDto) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        phoneCountryCode: dto.phoneCountryCode,
        phoneNumber: dto.phoneNumber,
        nationality: dto.nationality,
      },
    });
    return this.getMe(userId);
  }

  async updateResidentialDetails(userId: string, dto: ResidentialDetailsDto) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        houseNumber: dto.houseNumber,
        streetName: dto.streetName,
        city: dto.city,
        state: dto.state,
      },
    });
    return this.getMe(userId);
  }

  async completeOnboarding(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { onboardingCompletedAt: new Date() },
    });
    return this.getMe(userId);
  }

  async freezeAccount(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { isFrozen: true },
    });
    return { message: 'Account has been deactivated' };
  }

  async getReferrals(_userId: string) {
    return {
      referralCode: null as string | null,
      earnings: '0',
      referrals: [] as Array<{ id: string; name: string; date: string; earnings: string }>,
    };
  }

  async getLinkedBanks(userId: string) {
    const rows = await this.prisma.linkedBankAccount.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        accountNumber: true,
        bankName: true,
        accountName: true,
        currency: true,
        isDefault: true,
        bankCode: true,
        isVerified: true,
      },
    });
    return {
      items: rows.map((r) => ({
        id: r.id,
        accountNumber: r.accountNumber,
        bankName: r.bankName,
        accountName: r.accountName,
        currency: r.currency,
        isDefault: r.isDefault,
        bankCode: r.bankCode,
        isVerified: r.isVerified,
      })),
    };
  }

  async addLinkedBank(userId: string, dto: AddLinkedBankDto) {
    if (dto.currency !== 'NGN') {
      throw new BadRequestException('Only NGN linked banks are supported');
    }

    const accountNumber = dto.accountNumber.replace(/\D/g, '');
    if (accountNumber.length < 10 || accountNumber.length > 16) {
      throw new BadRequestException('Invalid account number');
    }

    const bankName = dto.bankName.trim().replace(/\s+/g, ' ');
    const accountName = dto.accountName.trim().replace(/\s+/g, ' ');
    if (bankName.length < 2 || accountName.length < 2) {
      throw new BadRequestException('Bank name and account name are required');
    }

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.linkedBankAccount.findUnique({
          where: {
            userId_currency_accountNumber: {
              userId,
              currency: Currency.NGN,
              accountNumber,
            },
          },
        });
        if (existing) {
          throw new ConflictException({
            code: 'LINKED_BANK_DUPLICATE',
            message: 'This bank account is already linked',
          });
        }

        const count = await tx.linkedBankAccount.count({ where: { userId } });
        const makeDefault = dto.isDefault === true || count === 0;

        if (makeDefault) {
          await tx.linkedBankAccount.updateMany({
            where: { userId },
            data: { isDefault: false },
          });
        }

        return tx.linkedBankAccount.create({
          data: {
            userId,
            currency: Currency.NGN,
            accountNumber,
            bankName,
            accountName,
            bankCode: dto.bankCode?.trim() || null,
            isDefault: makeDefault,
            isVerified: false,
          },
          select: {
            id: true,
            accountNumber: true,
            bankName: true,
            accountName: true,
            currency: true,
            isDefault: true,
          },
        });
      });

      return created;
    } catch (e) {
      if (e instanceof ConflictException || e instanceof BadRequestException) throw e;
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException({
          code: 'LINKED_BANK_DUPLICATE',
          message: 'This bank account is already linked',
        });
      }
      throw e;
    }
  }

  async removeLinkedBank(userId: string, id: string) {
    const row = await this.prisma.linkedBankAccount.findFirst({
      where: { id, userId },
    });
    if (!row) {
      throw new NotFoundException('Linked bank not found');
    }

    const withdrawalRefs = await this.prisma.withdrawal.count({
      where: { linkedBankAccountId: id },
    });
    if (withdrawalRefs > 0) {
      throw new BadRequestException({
        code: 'LINKED_BANK_IN_USE',
        message: 'Cannot remove a bank that has withdrawal history. Contact support if you need to replace it.',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      const wasDefault = row.isDefault;
      await tx.linkedBankAccount.delete({ where: { id } });

      if (wasDefault) {
        const next = await tx.linkedBankAccount.findFirst({
          where: { userId },
          orderBy: { createdAt: 'asc' },
        });
        if (next) {
          await tx.linkedBankAccount.update({
            where: { id: next.id },
            data: { isDefault: true },
          });
        }
      }
    });

    return { ok: true };
  }
}

