import * as fs from 'fs';
import * as path from 'path';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import configuration from '../../config/configuration';
import { PaymentModule } from './payment.module';
import { PaymentsPaystackWebhookController } from './payments-paystack-webhook.controller';
import { WithdrawalService } from '../withdrawal/withdrawal.service';
import { PAYOUT_PROVIDER } from '../payout/payout-provider.interface';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ThrottlerModule } from '@nestjs/throttler';

function mockPrisma(): Record<string, unknown> {
  const base: Record<string, unknown> = {
    user: { findUnique: jest.fn() },
    wallet: { findUnique: jest.fn() },
    walletFundingPayment: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    virtualAccount: { findFirst: jest.fn() },
    outboxEvent: { upsert: jest.fn() },
    notification: { create: jest.fn() },
    withdrawal: { findUnique: jest.fn(), update: jest.fn() },
  };
  base.$transaction = jest.fn((fn: (tx: Record<string, unknown>) => unknown) => fn(base));
  return base;
}

describe('PaymentModule DI', () => {
  const paymentModuleSrc = fs.readFileSync(path.join(__dirname, 'payment.module.ts'), 'utf8');
  const withdrawalModuleSrc = fs.readFileSync(
    path.join(__dirname, '../withdrawal/withdrawal.module.ts'),
    'utf8',
  );

  it('WithdrawalModule exports WithdrawalService', () => {
    expect(withdrawalModuleSrc).toMatch(/exports:\s*\[[^\]]*WithdrawalService/s);
  });

  it('PaymentModule imports WithdrawalModule and PayoutModule without declaring WithdrawalService', () => {
    expect(paymentModuleSrc).toContain('WithdrawalModule');
    expect(paymentModuleSrc).toContain('PayoutModule');
    expect(paymentModuleSrc).not.toMatch(/providers:\s*\[[^\]]*WithdrawalService/s);
  });

  it('resolves PaymentsPaystackWebhookController with WithdrawalService and PAYOUT_PROVIDER', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
        PaymentModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma() as unknown as PrismaService)
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    const controller = moduleRef.get(PaymentsPaystackWebhookController);
    expect(controller).toBeInstanceOf(PaymentsPaystackWebhookController);
    expect(moduleRef.get(WithdrawalService)).toBeInstanceOf(WithdrawalService);
    expect(moduleRef.get(PAYOUT_PROVIDER)).toBeDefined();
  });
});
