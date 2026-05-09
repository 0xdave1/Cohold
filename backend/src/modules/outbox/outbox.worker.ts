import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { JobRegistryService } from './job-registry.service';
import { OutboxService } from './outbox.service';

@Injectable()
export class OutboxWorker {
  private readonly logger = new Logger(OutboxWorker.name);
  private readonly enabled: boolean;
  private readonly batchSize: number;
  private readonly workerId = `outbox-worker:${process.pid}`;

  constructor(
    private readonly configService: ConfigService,
    private readonly outboxService: OutboxService,
    private readonly jobs: JobRegistryService,
  ) {
    this.enabled = this.configService.get<boolean>('config.outbox.workerEnabled') ?? false;
    this.batchSize = Number(this.configService.get<number>('config.outbox.batchSize') ?? 25);
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async processOutboxBatch() {
    const jobName = 'outbox_processor';
    if (!this.enabled) return;
    await this.jobs.markRunStart(jobName, new Date(Date.now() + 30_000));
    try {
      const events = await this.outboxService.claimNextBatch(this.workerId, this.batchSize);
      for (const event of events) {
        try {
          await this.outboxService.processEvent(event);
        } catch (error) {
          await this.outboxService.markFailedAndScheduleRetry(
            event.id,
            event.attempts,
            event.maxAttempts,
            error,
          );
        }
      }
      if (events.length > 0) {
        this.logger.log(`Processed outbox batch size=${events.length}`);
      }
      await this.jobs.markSuccess(jobName, new Date(Date.now() + 30_000));
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Outbox worker failure: ${msg}`);
      await this.jobs.markFailure(jobName, msg, new Date(Date.now() + 30_000));
    }
  }
}
