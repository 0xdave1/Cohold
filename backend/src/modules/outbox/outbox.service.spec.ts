import { NotificationChannel, OutboxEventStatus } from '@prisma/client';
import { OutboxService } from './outbox.service';

describe('OutboxService', () => {
  const prisma = {
    outboxEvent: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
    },
    notificationDelivery: {
      upsert: jest.fn(),
      update: jest.fn(),
    },
    user: { findUnique: jest.fn() },
  } as any;

  const config = {
    get: jest.fn((key: string) => {
      if (key === 'config.outbox.baseDelaySeconds') return 1;
      if (key === 'config.outbox.maxAttempts') return 3;
      if (key === 'config.outbox.websocketDeliveryEnabled') return true;
      if (key === 'config.outbox.emailDeliveryEnabled') return true;
      return undefined;
    }),
  } as any;

  const emailService = {
    sendTransactionEmail: jest.fn(),
    sendKycStatusEmail: jest.fn(),
    sendWelcomeEmail: jest.fn(),
  } as any;

  const userGateway = { server: { to: jest.fn().mockReturnValue({ emit: jest.fn() }) } } as any;

  let service: OutboxService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new OutboxService(prisma, config, emailService, userGateway);
  });

  it('deduplicates enqueue by idempotency key', async () => {
    prisma.outboxEvent.upsert.mockResolvedValue({ id: 'e1' });
    await service.enqueue({
      type: 'NOTIFICATION_DELIVERY',
      aggregateType: 'Notification',
      idempotencyKey: 'IDEMP:1',
      payload: { ok: true } as any,
    });
    await service.enqueue({
      type: 'NOTIFICATION_DELIVERY',
      aggregateType: 'Notification',
      idempotencyKey: 'IDEMP:1',
      payload: { ok: true } as any,
    });
    expect(prisma.outboxEvent.upsert).toHaveBeenCalledTimes(2);
  });

  it('supports enqueue inside caller transaction', async () => {
    const tx = {
      outboxEvent: {
        upsert: jest.fn().mockResolvedValue({ id: 'e1' }),
      },
    } as any;
    await service.enqueueInTransaction(tx, {
      type: 'NOTIFICATION_DELIVERY',
      aggregateType: 'Notification',
      idempotencyKey: 'TX:1',
      payload: { a: 1 } as any,
    });
    expect(tx.outboxEvent.upsert).toHaveBeenCalledTimes(1);
  });

  it('does not let two workers claim same event', async () => {
    // claimNextBatch: findMany (candidates) -> updateMany per id -> findMany (claimed rows)
    let findManyCalls = 0;
    prisma.outboxEvent.findMany.mockImplementation(async () => {
      findManyCalls += 1;
      if (findManyCalls <= 2) return [{ id: 'e1' }];
      if (findManyCalls === 3) return [{ id: 'e1' }];
      return [];
    });
    prisma.outboxEvent.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    const first = await service.claimNextBatch('w1', 10);
    const second = await service.claimNextBatch('w2', 10);
    expect(first.length).toBe(1);
    expect(second.length).toBe(0);
  });

  it('schedules retry on transient failure', async () => {
    await service.markFailedAndScheduleRetry('e1', 1, 3, new Error('temporary'));
    expect(prisma.outboxEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'e1' },
        data: expect.objectContaining({ status: OutboxEventStatus.PENDING }),
      }),
    );
  });

  it('moves event to dead-letter after max attempts', async () => {
    await service.markFailedAndScheduleRetry('e1', 3, 3, new Error('permanent'));
    expect(prisma.outboxEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: OutboxEventStatus.DEAD_LETTER }),
      }),
    );
  });

  it('delivers transaction email events', async () => {
    prisma.notificationDelivery.upsert.mockResolvedValue({ id: 'd1' });
    prisma.user.findUnique.mockResolvedValue({ email: 'user@example.com' });
    await service.processEvent({
      id: 'e1',
      type: 'NOTIFICATION_DELIVERY',
      payload: {
        channel: NotificationChannel.EMAIL,
        notificationId: 'n1',
        userId: 'u1',
        template: 'transaction',
        transactionKind: 'deposit',
        amount: '100.00',
        currency: 'NGN',
      } as any,
    });
    expect(emailService.sendTransactionEmail).toHaveBeenCalled();
    expect(prisma.outboxEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: OutboxEventStatus.COMPLETED }),
      }),
    );
  });

  it('sanitizes admin payload output', () => {
    const out = service.sanitizeOutboxEventForAdmin({
      id: 'e1',
      type: 'NOTIFICATION_DELIVERY',
      aggregateType: 'Notification',
      aggregateId: 'n1',
      idempotencyKey: 'k1',
      status: OutboxEventStatus.PENDING,
      priority: 1,
      attempts: 0,
      maxAttempts: 3,
      nextAttemptAt: new Date(),
      lockedAt: null,
      lockedBy: null,
      payload: { bvn: '12345678901', token: 'secret-token' } as any,
      sanitizedPayload: null,
      lastError: null,
      lastErrorAt: null,
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(JSON.stringify(out.payload)).not.toContain('12345678901');
    expect(JSON.stringify(out.payload).toLowerCase()).not.toContain('secret-token');
  });
});
