import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WithdrawalService } from './withdrawal.service';
import { JobRegistryService } from '../outbox/job-registry.service';

/**
 * Polls Paystack for stuck withdrawals (complement to webhooks).
 * TODO: tune interval / batch via config if needed.
 */
@Injectable()
export class WithdrawalReconciliationScheduler {
  private readonly logger = new Logger(WithdrawalReconciliationScheduler.name);

  constructor(
    private readonly withdrawalService: WithdrawalService,
    private readonly jobs: JobRegistryService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async reconcileStuckPayouts() {
    const jobName = 'withdrawal_reconciliation';
    await this.jobs.markRunStart(jobName, new Date(Date.now() + 10 * 60_000));
    try {
      const r = await this.withdrawalService.reconcileStaleWithdrawals(30, 30);
      if (r.scanned > 0) {
        this.logger.log(`Stale withdrawal reconciliation scanned=${r.scanned}`);
      }
      await this.jobs.markSuccess(jobName, new Date(Date.now() + 10 * 60_000));
    } catch (e) {
      this.logger.warn(`Stale withdrawal reconciliation cron error: ${e}`);
      await this.jobs.markFailure(
        jobName,
        e instanceof Error ? e.message : String(e),
        new Date(Date.now() + 10 * 60_000),
      );
    }
  }
}
