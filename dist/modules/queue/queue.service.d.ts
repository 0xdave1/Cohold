import { ConfigService } from '@nestjs/config';
import { Queue, Worker, JobsOptions } from 'bullmq';
type SupportedQueueName = 'email' | 'payment-reconciliation' | 'document-processing' | 'distribution' | 'audit';
export declare class QueueService {
    private readonly configService;
    private queues;
    constructor(configService: ConfigService);
    private getConnection;
    getQueue(name: SupportedQueueName): Queue;
    addJob<T = any>(name: SupportedQueueName, jobName: string, data: T, opts?: JobsOptions): Promise<void>;
    createWorker<T = any>(name: SupportedQueueName, processor: (job: {
        data: T;
    }) => Promise<void>): Worker;
}
export {};
