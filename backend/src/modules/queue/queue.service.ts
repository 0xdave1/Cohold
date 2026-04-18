import { Injectable, Logger, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConnectionOptions, JobsOptions, Queue, Worker } from 'bullmq';

type SupportedQueueName = 'email' | 'payment-reconciliation' | 'document-processing' | 'distribution' | 'audit';

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private readonly queues = new Map<SupportedQueueName, Queue>();
  private readonly workers: Worker[] = [];
  private connection: ConnectionOptions | null = null;
  private enabled = false;

  constructor(private readonly configService: ConfigService) {
    const url = this.configService.get<string>('config.redis.url');
    if (!url) {
      this.enabled = false;
      this.logger.warn('REDIS_URL not set. BullMQ queues are disabled.');
      return;
    }
    this.enabled = true;
    const parsed = new URL(url);
    const port = parsed.port ? parseInt(parsed.port, 10) : 6379;
    this.connection = {
      host: parsed.hostname,
      port,
      username: parsed.username || undefined,
      password: parsed.password || undefined,
      tls: parsed.protocol === 'rediss:' ? {} : undefined,
      maxRetriesPerRequest: null, // recommended for BullMQ
    };
    this.logger.log('BullMQ queues enabled.');
  }

  private assertEnabled() {
    if (!this.enabled || !this.connection) {
      throw new ServiceUnavailableException('Queue infrastructure unavailable.');
    }
  }

  getQueue(name: SupportedQueueName): Queue {
    this.assertEnabled();
    const existing = this.queues.get(name);
    if (existing) return existing;

    const q = new Queue(name, { connection: this.connection! });
    this.queues.set(name, q);
    return q;
  }

  async addJob<T = any>(
    name: SupportedQueueName,
    jobName: string,
    data: T,
    opts?: JobsOptions,
  ): Promise<void> {
    const q = this.getQueue(name);
    await q.add(jobName, data, opts);
  }

  createWorker<T = any>(
    name: SupportedQueueName,
    processor: (job: { data: T }) => Promise<void>,
  ): Worker {
    this.assertEnabled();
    const worker = new Worker(
      name,
      async (job) => processor({ data: job.data as T }),
      { connection: this.connection! },
    );
    worker.on('failed', (job, err) => {
      this.logger.error(`Worker failed (${name}) job=${job?.id}: ${err?.message ?? err}`);
    });
    this.workers.push(worker);
    return worker;
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled(this.workers.map((w) => w.close()));
    await Promise.allSettled(Array.from(this.queues.values()).map((q) => q.close()));
    this.workers.length = 0;
    this.queues.clear();
    this.connection = null;
  }
}
