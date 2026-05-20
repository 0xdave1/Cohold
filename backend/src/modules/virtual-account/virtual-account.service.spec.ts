import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Currency, KycStatus, VirtualAccountStatus } from '@prisma/client';
import { VirtualAccountService } from './virtual-account.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { KycPolicyService } from '../kyc/kyc-policy.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  VIRTUAL_ACCOUNT_PROVIDER,
  VirtualAccountProviderClient,
} from './virtual-account-provider.interface';

describe('VirtualAccountService (Issue 6)', () => {
  const prisma = {
    user: { findUnique: jest.fn() },
    virtualAccount: { findUnique: jest.fn(), upsert: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
    virtualAccountDepositEvent: { findMany: jest.fn(), create: jest.fn(), upsert: jest.fn() },
  };
  const provider: VirtualAccountProviderClient = {
    createVirtualAccount: jest.fn(),
    getVirtualAccountStatus: jest.fn(),
    maybeDeactivateVirtualAccount: jest.fn(),
  };
  const config = { get: jest.fn() };
  const kycPolicy = { assertFromUserSnapshot: jest.fn() };
  const notifications = {
    notifyVirtualAccountProvisioned: jest.fn(),
    notifyVirtualAccountProvisioningFailed: jest.fn(),
  };
  let service: VirtualAccountService;

  beforeEach(async () => {
    jest.resetAllMocks();
    config.get = jest.fn((key: string) => {
      if (key === 'VIRTUAL_ACCOUNTS_ENABLED') return 'true';
      if (key === 'PAYSTACK_VIRTUAL_ACCOUNT_ENABLED') return 'true';
      return undefined;
    });
    const moduleRef = await Test.createTestingModule({
      providers: [
        VirtualAccountService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: config },
        { provide: VIRTUAL_ACCOUNT_PROVIDER, useValue: provider },
        { provide: KycPolicyService, useValue: kycPolicy },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();
    service = moduleRef.get(VirtualAccountService);
  });

  it('stores ACTIVE account on provider success', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'u@x.com',
      firstName: 'U',
      lastName: 'One',
      isFrozen: false,
      kycStatus: KycStatus.VERIFIED,
    });
    prisma.virtualAccount.findUnique.mockResolvedValue(null);
    (provider.createVirtualAccount as jest.Mock).mockResolvedValue({
      status: VirtualAccountStatus.ACTIVE,
      accountNumber: '1234567890',
      accountName: 'U One',
      bankName: 'Wema Bank',
      bankCode: '035',
      providerAccountId: 'acct-1',
      providerReference: 'ref-1',
      rawProviderResponse: { ok: true },
    });
    prisma.virtualAccount.upsert.mockResolvedValue({
      id: 'va-1',
      status: VirtualAccountStatus.ACTIVE,
      currency: Currency.NGN,
      accountNumber: '1234567890',
      accountName: 'U One',
      bankName: 'Wema Bank',
      bankCode: '035',
      failureReason: null,
      updatedAt: new Date(),
    });

    const out = await service.createVirtualAccountForUser('u1');
    expect(out.status).toBe(VirtualAccountStatus.ACTIVE);
    expect(out.accountNumber).toBe('1234567890');
    expect(notifications.notifyVirtualAccountProvisioned).toHaveBeenCalled();
  });

  it('stores REQUIRES_RETRY without swallowing transient failure', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'u@x.com',
      firstName: 'U',
      lastName: 'One',
      isFrozen: false,
      kycStatus: KycStatus.VERIFIED,
    });
    prisma.virtualAccount.findUnique.mockResolvedValue(null);
    (provider.createVirtualAccount as jest.Mock).mockResolvedValue({
      status: VirtualAccountStatus.REQUIRES_RETRY,
      failureReason: 'Provider timeout',
      rawProviderResponse: { status: 'error' },
    });
    prisma.virtualAccount.upsert.mockResolvedValue({
      id: 'va-1',
      status: VirtualAccountStatus.REQUIRES_RETRY,
      currency: Currency.NGN,
      accountNumber: null,
      accountName: null,
      bankName: null,
      bankCode: null,
      failureReason: 'Provider timeout',
      updatedAt: new Date(),
    });

    const out = await service.createVirtualAccountForUser('u1');
    expect(out.status).toBe(VirtualAccountStatus.REQUIRES_RETRY);
    expect(out.accountNumber).toBeNull();
    expect(out.message).toMatch(/retry/i);
    expect(notifications.notifyVirtualAccountProvisioningFailed).toHaveBeenCalled();
  });

  it('retry path is idempotent over same unique account row', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'u@x.com',
      firstName: 'U',
      lastName: 'One',
      isFrozen: false,
      kycStatus: KycStatus.VERIFIED,
    });
    prisma.virtualAccount.findUnique.mockResolvedValue({
      id: 'va-1',
      status: VirtualAccountStatus.REQUIRES_RETRY,
      providerReference: 'ref-existing',
    });
    (provider.createVirtualAccount as jest.Mock).mockResolvedValue({
      status: VirtualAccountStatus.ACTIVE,
      accountNumber: '1234567890',
      accountName: 'U One',
      bankName: 'Wema Bank',
      providerReference: 'ref-existing',
      providerAccountId: 'acct-1',
    });
    prisma.virtualAccount.upsert.mockResolvedValue({
      id: 'va-1',
      status: VirtualAccountStatus.ACTIVE,
      currency: Currency.NGN,
      accountNumber: '1234567890',
      accountName: 'U One',
      bankName: 'Wema Bank',
      bankCode: null,
      failureReason: null,
      updatedAt: new Date(),
    });

    const out = await service.retryVirtualAccountForUser('u1');
    expect(out.status).toBe(VirtualAccountStatus.ACTIVE);
    expect(prisma.virtualAccount.upsert).toHaveBeenCalledTimes(1);
  });

  it('unverified user cannot provision virtual account', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'u@x.com',
      firstName: 'U',
      lastName: 'One',
      isFrozen: false,
      kycStatus: KycStatus.PENDING,
    });
    (kycPolicy.assertFromUserSnapshot as jest.Mock).mockImplementation(() => {
      throw new BadRequestException('KYC required');
    });
    await expect(service.createVirtualAccountForUser('u1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws when user does not exist', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.createVirtualAccountForUser('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
