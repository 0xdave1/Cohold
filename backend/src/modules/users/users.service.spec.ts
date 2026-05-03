import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { PAYOUT_PROVIDER } from '../payout/payout-provider.interface';
describe('UsersService linked banks', () => {
  let service: UsersService;

  const prismaMock = {
    linkedBankAccount: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      createMany: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
    },
    withdrawal: { count: jest.fn() },
    $transaction: jest.fn(),
    user: { findUnique: jest.fn(), update: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const storageMock = {
      createSignedReadUrl: jest.fn().mockResolvedValue('https://signed.example'),
    };
    const payoutProviderMock = {
      resolveBankAccount: jest.fn().mockResolvedValue({
        accountNumber: '0123456789',
        accountName: 'John Doe',
        bankCode: '058',
        bankName: 'GTBank',
        currency: 'NGN',
        isVerified: true,
      }),
      listSupportedBanks: jest.fn().mockResolvedValue([{ code: '058', name: 'GTBank' }]),
      getTransferStatus: jest.fn(),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: StorageService, useValue: storageMock },
        { provide: PAYOUT_PROVIDER, useValue: payoutProviderMock },
      ],
    }).compile();
    service = moduleRef.get(UsersService);
  });

  it('blocks duplicate linked bank (same user, currency, account number)', async () => {
    prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        linkedBankAccount: {
          findUnique: jest.fn().mockResolvedValue({ id: 'existing' }),
          count: jest.fn(),
          updateMany: jest.fn(),
          create: jest.fn(),
        },
      };
      return fn(tx as never);
    });

    await expect(
      service.addLinkedBank('u1', {
        currency: 'NGN',
        accountNumber: '0123456789',
        bankCode: '058',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('promotes another bank when deleting default', async () => {
    prismaMock.linkedBankAccount.findFirst.mockResolvedValueOnce({
      id: 'b1',
      userId: 'u1',
      isDefault: true,
    });
    prismaMock.withdrawal.count.mockResolvedValue(0);

    const tx = {
      linkedBankAccount: {
        delete: jest.fn(),
        findFirst: jest.fn().mockResolvedValue({ id: 'b2', userId: 'u1' }),
        update: jest.fn(),
      },
    };
    prismaMock.$transaction.mockImplementation(async (fn: (t: typeof tx) => Promise<void>) => fn(tx));

    await service.removeLinkedBank('u1', 'b1');

    expect(tx.linkedBankAccount.delete).toHaveBeenCalledWith({ where: { id: 'b1' } });
    expect(tx.linkedBankAccount.update).toHaveBeenCalledWith({
      where: { id: 'b2' },
      data: { isDefault: true },
    });
  });

  it('rejects linked bank when provider account resolution fails', async () => {
    const payoutProvider = (service as any).payoutProvider;
    payoutProvider.resolveBankAccount.mockRejectedValueOnce(
      new BadRequestException('Failed to verify bank account'),
    );

    await expect(
      service.addLinkedBank('u1', {
        currency: 'NGN',
        accountNumber: '0123456789',
        bankCode: '058',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
