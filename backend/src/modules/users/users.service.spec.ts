import { Test } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../../prisma/prisma.service';
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
    const moduleRef = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prismaMock }],
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
        bankName: 'GTBank',
        accountName: 'John Doe',
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
});
