import { ForbiddenException } from '@nestjs/common';
import { Currency } from '@prisma/client';
import { WalletService } from './wallet.service';

describe('WalletService dev-credit (Issue 1)', () => {
  let service: WalletService;
  const prisma = { $transaction: jest.fn() } as any;
  const virtualAccountService = {} as any;
  const notificationsService = { notifyWalletFunded: jest.fn() } as any;
  let prevEnv: string | undefined;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new WalletService(prisma, virtualAccountService, notificationsService);
    prevEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env.NODE_ENV = prevEnv;
  });

  it('devCredit is forbidden in production', async () => {
    process.env.NODE_ENV = 'production';
    await expect(
      service.devCredit('u1', { amount: '10', currency: Currency.NGN } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
