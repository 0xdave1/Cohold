import { ForbiddenException } from '@nestjs/common';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';

describe('WalletController (Issue 1 — no user self-credit)', () => {
  const walletService = {
    getBalances: jest.fn(),
    getVirtualAccounts: jest.fn(),
    swap: jest.fn(),
    getTransactions: jest.fn(),
    devCredit: jest.fn(),
  };

  let controller: WalletController;
  let prevEnv: string | undefined;

  beforeEach(() => {
    jest.resetAllMocks();
    controller = new WalletController(walletService as unknown as WalletService);
    prevEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env.NODE_ENV = prevEnv;
  });

  it('does not define a topUp handler (route removed — no POST /wallets/top-up)', () => {
    expect(Object.prototype.hasOwnProperty.call(WalletController.prototype, 'topUp')).toBe(false);
    expect(
      (WalletController.prototype as unknown as Record<string, unknown>)['topUp'],
    ).toBeUndefined();
  });

  it('POST dev-credit path rejects in production (controller guard)', async () => {
    process.env.NODE_ENV = 'production';
    await expect(
      controller.devCredit({ id: 'u1' } as never, { amount: '10', currency: 'NGN' } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(walletService.devCredit).not.toHaveBeenCalled();
  });

  it('POST dev-credit delegates to service when not production', async () => {
    process.env.NODE_ENV = 'development';
    walletService.devCredit.mockResolvedValue({ ok: true });
    await controller.devCredit({ id: 'u1' } as never, { amount: '10', currency: 'NGN' } as never);
    expect(walletService.devCredit).toHaveBeenCalledWith('u1', { amount: '10', currency: 'NGN' });
  });
});
