import * as fs from 'fs';
import * as path from 'path';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import configuration from '../../config/configuration';
import { WalletModule } from '../wallet/wallet.module';
import { AdminService } from './admin.service';
import { LedgerReconciliationService } from '../wallet/ledger-reconciliation.service';
import { StorageService } from '../storage/storage.service';
import { WithdrawalService } from '../withdrawal/withdrawal.service';
import { KycService } from '../kyc/kyc.service';
import { VirtualAccountService } from '../virtual-account/virtual-account.service';

function mockPrisma(): Record<string, unknown> {
  const base: Record<string, unknown> = {
    admin: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn() },
    user: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    property: { findMany: jest.fn(), count: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    withdrawal: { findMany: jest.fn(), findUnique: jest.fn() },
    kycVerification: { findMany: jest.fn(), count: jest.fn() },
    transaction: { findMany: jest.fn(), count: jest.fn() },
    investment: { aggregate: jest.fn(), groupBy: jest.fn() },
    distributionBatch: { count: jest.fn() },
    outboxEvent: { groupBy: jest.fn() },
    adminActivityLog: { findMany: jest.fn(), count: jest.fn(), create: jest.fn() },
  };
  base.$transaction = jest.fn((fn: (tx: Record<string, unknown>) => unknown) => fn(base));
  return base;
}

describe('AdminModule / AdminService (Ledger DI)', () => {
  it('admin.module.ts imports WalletModule and does not declare LedgerReconciliationService', () => {
    const src = fs.readFileSync(path.join(__dirname, 'admin.module.ts'), 'utf8');
    expect(src).toContain('WalletModule');
    expect(src).not.toContain('LedgerReconciliationService');
  });

  it('AdminService resolves LedgerReconciliationService from WalletModule (single provider graph)', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, load: [configuration] }), WalletModule],
      providers: [
        AdminService,
        { provide: StorageService, useValue: {} },
        { provide: WithdrawalService, useValue: {} },
        { provide: KycService, useValue: {} },
        { provide: VirtualAccountService, useValue: {} },
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma() as unknown as PrismaService)
      .compile();

    expect(moduleRef.get(AdminService)).toBeInstanceOf(AdminService);
    expect(moduleRef.get(LedgerReconciliationService)).toBeInstanceOf(LedgerReconciliationService);
  });
});
