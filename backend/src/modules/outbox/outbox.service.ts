import { Injectable, Logger } from '@nestjs/common';
import {
  NotificationChannel,
  NotificationDeliveryStatus,
  OutboxEventStatus,
  Prisma,
} from '@prisma/client';
import type { NotificationEmailDeliveryPayload } from './outbox.types';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { TransactionEmailKind } from '../email/types/email.types';
import { UserGateway } from '../gateway/user.gateway';
import { redactSensitive } from '../../common/logging/security-redaction.util';
import { EnqueueOutboxInput, NotificationDeliveryPayload } from './outbox.types';

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);
  private readonly baseDelaySeconds: number;
  private readonly defaultMaxAttempts: number;
  private readonly websocketDeliveryEnabled: boolean;
  private readonly emailDeliveryEnabled: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    private readonly userGateway: UserGateway,
  ) {
    this.baseDelaySeconds = Number(
      this.configService.get<number>('config.outbox.baseDelaySeconds') ?? 30,
    );
    this.defaultMaxAttempts = Number(
      this.configService.get<number>('config.outbox.maxAttempts') ?? 5,
    );
    this.websocketDeliveryEnabled =
      this.configService.get<boolean>('config.outbox.websocketDeliveryEnabled') ?? true;
    this.emailDeliveryEnabled =
      this.configService.get<boolean>('config.outbox.emailDeliveryEnabled') ?? true;
  }

  async enqueue(event: EnqueueOutboxInput) {
    return this.prisma.outboxEvent.upsert({
      where: { idempotencyKey: event.idempotencyKey },
      update: {},
      create: {
        type: event.type,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId ?? null,
        idempotencyKey: event.idempotencyKey,
        status: OutboxEventStatus.PENDING,
        priority: event.priority ?? 5,
        maxAttempts: event.maxAttempts ?? this.defaultMaxAttempts,
        nextAttemptAt: event.nextAttemptAt ?? new Date(),
        payload: event.payload,
        ...(event.sanitizedPayload !== undefined
          ? { sanitizedPayload: event.sanitizedPayload }
          : {}),
      },
    });
  }

  async enqueueInTransaction(tx: Prisma.TransactionClient, event: EnqueueOutboxInput) {
    return tx.outboxEvent.upsert({
      where: { idempotencyKey: event.idempotencyKey },
      update: {},
      create: {
        type: event.type,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId ?? null,
        idempotencyKey: event.idempotencyKey,
        status: OutboxEventStatus.PENDING,
        priority: event.priority ?? 5,
        maxAttempts: event.maxAttempts ?? this.defaultMaxAttempts,
        nextAttemptAt: event.nextAttemptAt ?? new Date(),
        payload: event.payload,
        ...(event.sanitizedPayload !== undefined
          ? { sanitizedPayload: event.sanitizedPayload }
          : {}),
      },
    });
  }

  async claimNextBatch(workerId: string, limit: number) {
    const candidates = await this.prisma.outboxEvent.findMany({
      where: {
        status: OutboxEventStatus.PENDING,
        nextAttemptAt: { lte: new Date() },
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      take: limit,
      select: { id: true },
    });
    const claimedIds: string[] = [];
    for (const c of candidates) {
      const claimed = await this.prisma.outboxEvent.updateMany({
        where: {
          id: c.id,
          status: OutboxEventStatus.PENDING,
          nextAttemptAt: { lte: new Date() },
        },
        data: {
          status: OutboxEventStatus.PROCESSING,
          lockedAt: new Date(),
          lockedBy: workerId,
          attempts: { increment: 1 },
        },
      });
      if (claimed.count === 1) claimedIds.push(c.id);
    }
    if (claimedIds.length === 0) return [];
    return this.prisma.outboxEvent.findMany({
      where: { id: { in: claimedIds } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async processEvent(event: { id: string; type: string; payload: Prisma.JsonValue }) {
    if (event.type === 'NOTIFICATION_DELIVERY') {
      await this.processNotificationDelivery(event.id, event.payload);
      return;
    }
    await this.markCompleted(event.id);
  }

  private async processNotificationDelivery(eventId: string, payload: Prisma.JsonValue) {
    const p = payload as NotificationDeliveryPayload;
    if (!p || typeof p !== 'object' || !('notificationId' in p) || !('channel' in p)) {
      throw new Error('Invalid delivery payload');
    }

    let prismaChannel: (typeof NotificationChannel)[keyof typeof NotificationChannel];
    if (p.channel === 'EMAIL') prismaChannel = NotificationChannel.EMAIL;
    else if (p.channel === 'WEBSOCKET') prismaChannel = NotificationChannel.WEBSOCKET;
    else throw new Error(`Unsupported notification channel: ${String((p as { channel?: string }).channel)}`);

    const delivery = await this.prisma.notificationDelivery.upsert({
      where: {
        notificationId_channel: {
          notificationId: p.notificationId,
          channel: prismaChannel,
        },
      },
      update: { attempts: { increment: 1 } },
      create: {
        notificationId: p.notificationId,
        channel: prismaChannel,
        status: NotificationDeliveryStatus.PENDING,
        attempts: 1,
      },
    });

    try {
      if (p.channel === 'EMAIL') {
        if (!this.emailDeliveryEnabled) {
          await this.prisma.notificationDelivery.update({
            where: { id: delivery.id },
            data: { status: NotificationDeliveryStatus.SENT, sentAt: new Date() },
          });
          await this.markCompleted(eventId);
          return;
        }
        await this.deliverEmail(p);
      } else if (p.channel === 'WEBSOCKET') {
        if (this.websocketDeliveryEnabled) {
          this.userGateway.server
            ?.to(`user:${p.userId}`)
            .emit(p.event, p.data);
        }
      }
      await this.prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: { status: NotificationDeliveryStatus.SENT, sentAt: new Date(), lastError: null },
      });
      await this.markCompleted(eventId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: { status: NotificationDeliveryStatus.FAILED, lastError: errorMessage },
      });
      throw error;
    }
  }

  private async deliverEmail(payload: NotificationEmailDeliveryPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
      select: { email: true },
    });
    if (!user?.email) throw new Error('Notification email recipient missing');

    if (payload.template === 'transaction') {
      if (!payload.transactionKind || !payload.amount || !payload.currency) {
        throw new Error('Invalid transaction email payload');
      }
      await this.emailService.sendTransactionEmail(
        user.email,
        payload.transactionKind as TransactionEmailKind,
        payload.amount,
        payload.currency,
        payload.details,
      );
      return;
    }
    if (payload.template === 'kyc') {
      await this.emailService.sendKycStatusEmail(
        user.email,
        payload.kycStatus ?? 'submitted',
        payload.kycReason,
      );
      return;
    }
    if (payload.template === 'welcome') {
      await this.emailService.sendWelcomeEmail(user.email, payload.firstName);
    }
  }

  async markCompleted(id: string) {
    await this.prisma.outboxEvent.update({
      where: { id },
      data: {
        status: OutboxEventStatus.COMPLETED,
        completedAt: new Date(),
        lockedAt: null,
        lockedBy: null,
        lastError: null,
      },
    });
  }

  async markFailedAndScheduleRetry(id: string, currentAttempts: number, maxAttempts: number, error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (currentAttempts >= maxAttempts) {
      await this.moveToDeadLetter(id, errorMessage);
      return;
    }
    const delaySeconds = Math.max(this.baseDelaySeconds, this.baseDelaySeconds * 2 ** (currentAttempts - 1));
    const nextAttemptAt = new Date(Date.now() + delaySeconds * 1000);
    await this.prisma.outboxEvent.update({
      where: { id },
      data: {
        status: OutboxEventStatus.PENDING,
        nextAttemptAt,
        lockedAt: null,
        lockedBy: null,
        lastError: errorMessage,
        lastErrorAt: new Date(),
      },
    });
    this.logger.warn(
      `Outbox retry scheduled id=${id} attempts=${currentAttempts} next=${nextAttemptAt.toISOString()} err=${errorMessage}`,
    );
  }

  async moveToDeadLetter(id: string, errorMessage: string) {
    await this.prisma.outboxEvent.update({
      where: { id },
      data: {
        status: OutboxEventStatus.DEAD_LETTER,
        lockedAt: null,
        lockedBy: null,
        lastError: errorMessage,
        lastErrorAt: new Date(),
      },
    });
    this.logger.error(`Outbox dead-letter id=${id}: ${errorMessage}`);
  }

  async retryDeadLetter(id: string) {
    return this.prisma.outboxEvent.updateMany({
      where: { id, status: OutboxEventStatus.DEAD_LETTER },
      data: {
        status: OutboxEventStatus.PENDING,
        nextAttemptAt: new Date(),
        lockedAt: null,
        lockedBy: null,
      },
    });
  }

  listOutbox(params: { status?: OutboxEventStatus; type?: string; take?: number }) {
    return this.prisma.outboxEvent.findMany({
      where: {
        ...(params.status ? { status: params.status } : {}),
        ...(params.type ? { type: params.type } : {}),
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      take: params.take ?? 100,
    });
  }

  async getOutboxById(id: string) {
    return this.prisma.outboxEvent.findUnique({ where: { id } });
  }

  listDeadLetter(take = 100) {
    return this.prisma.outboxEvent.findMany({
      where: { status: OutboxEventStatus.DEAD_LETTER },
      orderBy: { updatedAt: 'desc' },
      take,
    });
  }

  async backlogSummary() {
    const [pending, processing, deadLetter] = await Promise.all([
      this.prisma.outboxEvent.count({ where: { status: OutboxEventStatus.PENDING } }),
      this.prisma.outboxEvent.count({ where: { status: OutboxEventStatus.PROCESSING } }),
      this.prisma.outboxEvent.count({ where: { status: OutboxEventStatus.DEAD_LETTER } }),
    ]);
    return { pending, processing, deadLetter };
  }

  sanitizeOutboxEventForAdmin(event: {
    id: string;
    type: string;
    aggregateType: string;
    aggregateId: string | null;
    idempotencyKey: string;
    status: OutboxEventStatus;
    priority: number;
    attempts: number;
    maxAttempts: number;
    nextAttemptAt: Date;
    lockedAt: Date | null;
    lockedBy: string | null;
    payload: Prisma.JsonValue;
    sanitizedPayload: Prisma.JsonValue | null;
    lastError: string | null;
    lastErrorAt: Date | null;
    completedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      ...event,
      payload: event.sanitizedPayload ?? (redactSensitive(event.payload) as Prisma.JsonValue),
      sanitizedPayload: undefined,
    };
  }
}
