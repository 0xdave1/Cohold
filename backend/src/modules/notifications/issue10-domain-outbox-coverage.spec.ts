import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Issue 10 domain-event notification/outbox coverage table.
 *
 * | Domain event | Coverage decision |
 * | --- | --- |
 * | wallet funding credited | `PaymentService.verifyWalletFunding` and webhook paths call `notifyWalletFundedInTransaction` inside Prisma tx. |
 * | withdrawal completed | `WithdrawalService.markCompleted` emits durable notification + outbox delivery via `notifyWithdrawalCompleted`. |
 * | withdrawal failed | `WithdrawalService.markFailed` emits durable notification + outbox delivery via `notifyWithdrawalFailed`. |
 * | withdrawal reconciliation-required | `WithdrawalService.moveToReconciliationRequired` emits system notification via `notifyWithdrawalReconciliationRequired`. |
 * | KYC approved/rejected/requires-review | `KycService` calls `notifyKycApproved` / `notifyKycRejected` / `notifyKycRequiresReview`. |
 * | virtual account active/failed | `VirtualAccountService.createVirtualAccountForUser` calls `notifyVirtualAccountProvisioned` / `notifyVirtualAccountProvisioningFailed`. |
 * | investment purchase completed | `InvestmentService` calls `notifyInvestmentSuccess`. |
 * | investment sell-back completed/failed | completed path calls `notifyInvestmentSold`; failed sell-back has no user notification by design (state not finalized / retriable path, avoid noisy duplicates). |
 * | distribution posted/failed | posted item path calls `notifyRoiCredited`; failed item notification intentionally omitted (ops/admin remediation flow, user wallet unaffected until posted). |
 */
describe('Issue 10 domain outbox coverage map', () => {
  const readRel = (relPath: string) => readFileSync(join(process.cwd(), relPath), 'utf8');

  it('uses transactional enqueue path for representative financial event', () => {
    const payment = readRel('src/modules/payment/payment.service.ts');
    expect(payment).toContain('notifyWalletFundedInTransaction(');
  });

  it('covers reconciliation-required + virtual-account provisioning notifications', () => {
    const withdrawal = readRel('src/modules/withdrawal/withdrawal.service.ts');
    const va = readRel('src/modules/virtual-account/virtual-account.service.ts');
    expect(withdrawal).toContain('notifyWithdrawalReconciliationRequired(');
    expect(va).toContain('notifyVirtualAccountProvisioned(');
    expect(va).toContain('notifyVirtualAccountProvisioningFailed(');
  });
});
