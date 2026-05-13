import * as fs from 'fs';
import * as path from 'path';
import { Test } from '@nestjs/testing';
import { KycStatus, SupportStatus, WithdrawalStatus, DistributionBatchStatus } from '@prisma/client';
import { AdminService } from './admin.service';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { WithdrawalService } from '../withdrawal/withdrawal.service';
import { LedgerReconciliationService } from '../wallet/ledger-reconciliation.service';
import { KycService } from '../kyc/kyc.service';
import { VirtualAccountService } from '../virtual-account/virtual-account.service';

describe('Admin launch readiness (Issue 12)', () => {
  it('GET admin/launch-readiness is declared with SUPER_ADMIN and COMPLIANCE_ADMIN', () => {
    const file = fs.readFileSync(path.join(__dirname, 'admin.controller.ts'), 'utf8');
    const idx = file.indexOf(`@Get('launch-readiness')`);
    expect(idx).toBeGreaterThan(-1);
    const window = file.slice(Math.max(0, idx - 250), idx);
    expect(window).toContain('SUPER_ADMIN');
    expect(window).toContain('COMPLIANCE_ADMIN');
  });

  it('getLaunchReadiness reports Issue 7 as MANUAL_CHECK_REQUIRED and never implies certification', async () => {
    const prisma = {
      withdrawal: {
        count: jest.fn().mockResolvedValue(0),
      },
      distributionBatch: { count: jest.fn().mockResolvedValue(0) },
      outboxEvent: {
        groupBy: jest.fn().mockResolvedValue([
          { status: 'PENDING', _count: 2 },
          { status: 'COMPLETED', _count: 10 },
        ]),
      },
      user: {
        count: jest.fn().mockResolvedValue(0),
      },
      supportConversation: { count: jest.fn().mockResolvedValue(0) },
    };

    const ledger = {
      buildReport: jest.fn().mockResolvedValue({
        generatedAt: new Date().toISOString(),
        walletBalanceMismatches: [],
        transactionsWithoutLedgerOperation: 0,
        unbalancedLedgerOperations: [],
        shortLedgerOperations: [],
      }),
    };

    const virtualAccountService = {
      listFailedProvisioning: jest.fn().mockResolvedValue([]),
      listUnmatchedDeposits: jest.fn().mockResolvedValue([]),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: prisma },
        { provide: StorageService, useValue: {} },
        { provide: WithdrawalService, useValue: {} },
        { provide: LedgerReconciliationService, useValue: ledger },
        { provide: KycService, useValue: {} },
        { provide: VirtualAccountService, useValue: virtualAccountService },
      ],
    }).compile();

    const adminService = moduleRef.get(AdminService);
    const out = await adminService.getLaunchReadiness();

    expect(out.issue7InvestmentConcurrency.status).toBe('MANUAL_CHECK_REQUIRED');
    expect(out.issue7InvestmentConcurrency.detail).toMatch(/Issue 7/i);
    expect(out.assessmentNote).toMatch(/not certify/i);
    expect(Array.isArray(out.blockers)).toBe(true);
    expect(Array.isArray(out.warnings)).toBe(true);
    expect(out.financialOps).toBeDefined();

    expect(prisma.withdrawal.count).toHaveBeenCalledWith({
      where: { status: WithdrawalStatus.RECONCILIATION_REQUIRED },
    });
    expect(prisma.supportConversation.count).toHaveBeenCalledWith({
      where: {
        status: { in: [SupportStatus.OPEN, SupportStatus.WAITING_FOR_ADMIN, SupportStatus.LIVE] },
      },
    });
    expect(prisma.user.count).toHaveBeenCalledWith({ where: { kycStatus: KycStatus.REQUIRES_REVIEW } });
    expect(prisma.distributionBatch.count).toHaveBeenCalledWith({
      where: { status: DistributionBatchStatus.PARTIALLY_FAILED },
    });
  });
});
