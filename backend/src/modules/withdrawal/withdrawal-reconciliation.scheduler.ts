import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WithdrawalService } from './withdrawal.service';

/**
 * Polls Flutterwave for stuck withdrawals (complement to webhooks).
 * TODO: tune interval / batch via config if needed.
 */
@Injectable()
export class WithdrawalReconciliationScheduler {
  private readonly logger = new Logger(WithdrawalReconciliationScheduler.name);

  constructor(private readonly withdrawalService: WithdrawalService) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async reconcileStuckPayouts() {
    try {
      const r = await this.withdrawalService.reconcileStaleWithdrawals(30, 30);
      if (r.scanned > 0) {
        this.logger.log(`Stale withdrawal reconciliation scanned=${r.scanned}`);
      }
    } catch (e) {
      this.logger.warn(`Stale withdrawal reconciliation cron error: ${e}`);
    }
  }
}
