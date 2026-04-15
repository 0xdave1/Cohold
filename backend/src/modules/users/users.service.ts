import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { PersonalDetailsDto } from './dto/personal-details.dto';
import { ResidentialDetailsDto } from './dto/residential-details.dto';
import { assertValidUsername, normalizeUsername, validateUsername } from '../../common/username/username.util';
import { Prisma } from '@prisma/client';

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

  async getLinkedBanks(_userId: string) {
    return { items: [] as Array<{ id: string; accountNumber: string; bankName: string; accountName: string; currency: string }> };
  }

  async addLinkedBank(_userId: string, _body: { currency: string; accountNumber: string; bankName: string; accountName: string }) {
    return { id: 'stub-1', message: 'Linked bank added (stub)' };
  }

  async removeLinkedBank(_userId: string, _id: string) {
    return { message: 'Linked bank removed (stub)' };
  }
}

