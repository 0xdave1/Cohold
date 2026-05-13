import { NotFoundException } from '@nestjs/common';
import { WithdrawalService } from './withdrawal.service';

describe('WithdrawalService getWithdrawalReceipt (Issue 12)', () => {
  const prisma = { withdrawal: { findFirst: jest.fn() } } as any;
  const authService = {} as any;
  const notificationsService = {} as any;
  const walletService = {} as any;
  const kycPolicy = {} as any;
  const payoutProvider = {} as any;
  let service: WithdrawalService;

  const withdrawalRow = {
    id: 'wd-1',
    reference: 'WD-REF-1',
    amount: { toString: () => '100.0000' },
    fee: { toString: () => '2.0000' },
    netAmount: { toString: () => '98.0000' },
    currency: 'NGN',
    status: 'COMPLETED',
    initiatedAt: new Date(),
    processedAt: new Date(),
    completedAt: new Date(),
    providerReference: 'FW-PROV-9',
    linkedBankAccount: {
      bankName: 'GTBank',
      accountName: 'Jane Doe',
      accountNumber: '0123456789',
    },
  };

  beforeEach(() => {
    jest.resetAllMocks();
    service = new WithdrawalService(
      prisma,
      authService,
      notificationsService,
      walletService,
      kycPolicy,
      payoutProvider,
    );
  });

  it('returns not found for another user (no cross-user receipt)', async () => {
    prisma.withdrawal.findFirst.mockResolvedValue(null);
    await expect(service.getWithdrawalReceipt('other-user', 'wd-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('allows owner and masks bank account (no full PAN in payload)', async () => {
    prisma.withdrawal.findFirst.mockResolvedValue(withdrawalRow);
    const receipt = await service.getWithdrawalReceipt('owner-1', 'wd-1');

    expect(receipt.pdfAvailable).toBe(false);
    expect(receipt.disclaimer).toMatch(/not a bank guarantee/i);
    expect(receipt.recipientAccountLast4).toBe('****6789');
    expect(receipt.recipientBankName).toBe('GTBank');

    const serialized = JSON.stringify(receipt);
    expect(serialized).not.toContain('0123456789');
    expect(serialized).not.toMatch(/sk_live/i);
  });
});
