// Redis/Queue temporarily disabled – can be re-enabled later

import { Injectable } from '@nestjs/common';

type SupportedQueueName =
  | 'email'
  | 'payment-reconciliation'
  | 'document-processing'
  | 'distribution'
  | 'audit';

type Queue = any;
type Worker = any;
type JobsOptions = any;

@Injectable()
export class QueueService {
  constructor() {}

  getQueue(_name: SupportedQueueName): Queue {
    throw new Error(
      'Redis temporarily disabled – cannot use queues. Re-enable Redis and BullMQ in queue.service.ts to use QueueService.getQueue().',
    );
  }

  async addJob<T = any>(
    _name: SupportedQueueName,
    _jobName: string,
    _data: T,
    _opts?: JobsOptions,
  ): Promise<void> {
    throw new Error(
      'Redis temporarily disabled – cannot add jobs. Re-enable Redis and BullMQ in queue.service.ts to use QueueService.addJob().',
    );
  }

  createWorker<T = any>(
    _name: SupportedQueueName,
    _processor: (job: { data: T }) => Promise<void>,
  ): Worker {
    throw new Error(
      'Redis temporarily disabled – cannot create workers. Re-enable Redis and BullMQ in queue.service.ts to use QueueService.createWorker().',
    );
  }
}
