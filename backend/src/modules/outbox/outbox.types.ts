import type { OutboxEventStatus, Prisma } from '@prisma/client';

export type OutboxStatus = OutboxEventStatus;

export type EnqueueOutboxInput = {
  type: string;
  aggregateType: string;
  aggregateId?: string | null;
  idempotencyKey: string;
  priority?: number;
  maxAttempts?: number;
  nextAttemptAt?: Date;
  payload: Prisma.InputJsonValue;
  sanitizedPayload?: Prisma.InputJsonValue;
};

/** Prisma merges const+type `NotificationChannel`; use literals so discriminated unions narrow. */
export type NotificationEmailDeliveryPayload = {
  channel: 'EMAIL';
  notificationId: string;
  userId: string;
  template: 'transaction' | 'kyc' | 'welcome';
  transactionKind?: string;
  amount?: string;
  currency?: string;
  details?: Record<string, unknown>;
  kycStatus?: 'submitted' | 'approved' | 'rejected';
  kycReason?: string;
  firstName?: string;
};

export type NotificationWebsocketDeliveryPayload = {
  channel: 'WEBSOCKET';
  notificationId: string;
  userId: string;
  event: string;
  data: Record<string, unknown>;
};

export type NotificationDeliveryPayload =
  | NotificationEmailDeliveryPayload
  | NotificationWebsocketDeliveryPayload;
