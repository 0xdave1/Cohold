import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationChannel, NotificationType, Prisma } from '@prisma/client';
import { OutboxService } from '../outbox/outbox.service';

export interface CreateNotificationPayload {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  metadata?: Prisma.InputJsonValue; // ✅ CORRECT
}

export interface ListNotificationsQuery {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
}

export interface NotificationResponse {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  readAt: Date | null;
  link: string | null;
  metadata: Prisma.JsonValue;
  createdAt: Date;
}

export interface PaginatedNotificationsResponse {
  data: NotificationResponse[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  private enqueueDelivery(
    idempotencyKey: string,
    payload: Prisma.InputJsonValue,
    aggregateId?: string,
  ): Promise<unknown> {
    return this.outbox.enqueue({
      type: 'NOTIFICATION_DELIVERY',
      aggregateType: 'Notification',
      aggregateId,
      idempotencyKey,
      payload,
      sanitizedPayload: payload,
      priority: 5,
    });
  }

  private enqueueDeliveryInTransaction(
    tx: Prisma.TransactionClient,
    idempotencyKey: string,
    payload: Prisma.InputJsonValue,
    aggregateId?: string,
  ): Promise<unknown> {
    return this.outbox.enqueueInTransaction(tx, {
      type: 'NOTIFICATION_DELIVERY',
      aggregateType: 'Notification',
      aggregateId,
      idempotencyKey,
      payload,
      sanitizedPayload: payload,
      priority: 5,
    });
  }

  private sanitizeReason(reason?: string): string | undefined {
    if (!reason) return reason;
    return reason.replace(/\b\d{6,16}\b/g, '***');
  }

  /**
   * List notifications for a user with pagination and optional unread filter.
   */
  async listUserNotifications(
    userId: string,
    query: ListNotificationsQuery = {},
  ): Promise<PaginatedNotificationsResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(query.unreadOnly ? { isRead: false } : {}),
    };

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          type: true,
          title: true,
          message: true,
          isRead: true,
          readAt: true,
          link: true,
          metadata: true,
          createdAt: true,
        },
      }),
      this.prisma.notification.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: notifications,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    };
  }

  /**
   * Get unread notification count for a user.
   */
  async getUnreadCount(userId: string): Promise<{ unreadCount: number }> {
    const count = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { unreadCount: count };
  }

  /**
   * Mark a single notification as read.
   * Enforces ownership - user can only mark their own notifications.
   */
  async markAsRead(userId: string, notificationId: string): Promise<NotificationResponse> {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.userId !== userId) {
      throw new ForbiddenException('You can only access your own notifications');
    }

    if (notification.isRead) {
      return {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        isRead: notification.isRead,
        readAt: notification.readAt,
        link: notification.link,
        metadata: notification.metadata,
        createdAt: notification.createdAt,
      };
    }

    const updated = await this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        isRead: true,
        readAt: true,
        link: true,
        metadata: true,
        createdAt: true,
      },
    });

    return updated;
  }

  /**
   * Mark all unread notifications as read for a user.
   */
  async markAllAsRead(userId: string): Promise<{ markedCount: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return { markedCount: result.count };
  }

  /**
   * Create a single notification.
   * Called from other services (investment, wallet, KYC, admin) when business events occur.
   */
  async createNotification(payload: CreateNotificationPayload): Promise<NotificationResponse> {
    try {
      const notification = await this.prisma.notification.create({
        data: {
          userId: payload.userId,
          type: payload.type,
          title: payload.title,
          message: payload.message,
          link: payload.link,
          metadata: payload.metadata ?? Prisma.JsonNull,
        },
        select: {
          id: true,
          type: true,
          title: true,
          message: true,
          isRead: true,
          readAt: true,
          link: true,
          metadata: true,
          createdAt: true,
        },
      });

      return notification;
    } catch (err) {
      this.logger.error(
        `Failed to persist notification type=${payload.type} userId=${payload.userId}`,
        err instanceof Error ? err.stack : err,
      );
      throw err;
    }
  }

  /**
   * Create multiple notifications in a batch.
   * Useful for broadcast messages or bulk operations.
   */
  async createManyNotifications(
    payloads: CreateNotificationPayload[],
  ): Promise<{ createdCount: number }> {
    if (payloads.length === 0) {
      return { createdCount: 0 };
    }

    const result = await this.prisma.notification.createMany({
      data: payloads.map((p) => ({
        userId: p.userId,
        type: p.type,
        title: p.title,
        message: p.message,
        link: p.link,
        metadata: p.metadata ?? Prisma.JsonNull,
      })),
    });

    return { createdCount: result.count };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // HELPER METHODS FOR COMMON BUSINESS EVENTS
  // These can be called directly from other services.
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Notify user of successful investment.
   */
  async notifyInvestmentSuccess(
    userId: string,
    propertyTitle: string,
    amount: string,
    currency: string,
    investmentId: string,
  ): Promise<NotificationResponse> {
    const notification = await this.createNotification({
      userId,
      type: NotificationType.INVESTMENT_SUCCESS,
      title: 'Investment Successful',
      message: `You have successfully invested ${currency} ${amount} in ${propertyTitle}.`,
      link: `/dashboard/investments/${investmentId}`,
      metadata: { investmentId, propertyTitle, amount, currency },
    });
    await this.enqueueDelivery(
      `EMAIL:INVESTMENT_SUCCESS:${investmentId}`,
      {
        channel: NotificationChannel.EMAIL,
        notificationId: notification.id,
        userId,
        template: 'transaction',
        transactionKind: 'investment_success',
        amount,
        currency,
        details: { reference: investmentId, propertyTitle },
      } as Prisma.InputJsonValue,
      notification.id,
    );
    return notification;
  }

  /**
   * Notify user of investment sale.
   */
  async notifyInvestmentSold(
    userId: string,
    propertyTitle: string,
    amount: string,
    currency: string,
    investmentId: string,
  ): Promise<NotificationResponse> {
    const notification = await this.createNotification({
      userId,
      type: NotificationType.INVESTMENT_SOLD,
      title: 'Investment Sold',
      message: `You have sold your shares in ${propertyTitle} for ${currency} ${amount}.`,
      link: `/dashboard/investments/${investmentId}`,
      metadata: { investmentId, propertyTitle, amount, currency },
    });
    await this.enqueueDelivery(
      `EMAIL:INVESTMENT_SOLD:${investmentId}`,
      {
        channel: NotificationChannel.EMAIL,
        notificationId: notification.id,
        userId,
        template: 'transaction',
        transactionKind: 'investment_sale',
        amount,
        currency,
        details: { reference: investmentId, propertyTitle },
      } as Prisma.InputJsonValue,
      notification.id,
    );
    return notification;
  }

  /**
   * Notify user of wallet funding.
   */
  async notifyWalletFunded(
    userId: string,
    amount: string,
    currency: string,
    transactionId?: string,
  ): Promise<NotificationResponse> {
    const notification = await this.createNotification({
      userId,
      type: NotificationType.WALLET_FUNDED,
      title: 'Wallet Funded',
      message: `Your wallet has been credited with ${currency} ${amount}.`,
      link: '/dashboard/wallet',
      metadata: { amount, currency, transactionId },
    });
    await this.enqueueDelivery(
      `EMAIL:WALLET_FUNDED:${transactionId ?? notification.id}`,
      {
        channel: NotificationChannel.EMAIL,
        notificationId: notification.id,
        userId,
        template: 'transaction',
        transactionKind: 'deposit',
        amount,
        currency,
        details: { reference: transactionId },
      } as Prisma.InputJsonValue,
      notification.id,
    );
    return notification;
  }

  /**
   * Transactional variant for durable wallet-funding side effects:
   * writes both Notification and OutboxEvent in the same DB transaction.
   */
  async notifyWalletFundedInTransaction(
    tx: Prisma.TransactionClient,
    userId: string,
    amount: string,
    currency: string,
    transactionId?: string,
  ): Promise<NotificationResponse> {
    const notification = await tx.notification.create({
      data: {
        userId,
        type: NotificationType.WALLET_FUNDED,
        title: 'Wallet Funded',
        message: `Your wallet has been credited with ${currency} ${amount}.`,
        link: '/dashboard/wallet',
        metadata: { amount, currency, transactionId } as Prisma.InputJsonValue,
      },
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        isRead: true,
        readAt: true,
        link: true,
        metadata: true,
        createdAt: true,
      },
    });
    await this.enqueueDeliveryInTransaction(
      tx,
      `EMAIL:WALLET_FUNDED:${transactionId ?? notification.id}`,
      {
        channel: NotificationChannel.EMAIL,
        notificationId: notification.id,
        userId,
        template: 'transaction',
        transactionKind: 'deposit',
        amount,
        currency,
        details: { reference: transactionId },
      } as Prisma.InputJsonValue,
      notification.id,
    );
    return notification;
  }

  /**
   * Notify user of withdrawal initiated.
   */
  async notifyWithdrawalInitiated(
    userId: string,
    amount: string,
    currency: string,
    transactionId?: string,
  ): Promise<NotificationResponse> {
    const notification = await this.createNotification({
      userId,
      type: NotificationType.WITHDRAWAL_INITIATED,
      title: 'Withdrawal Initiated',
      message: `Your withdrawal of ${currency} ${amount} has been initiated and is being processed.`,
      link: '/dashboard/wallet',
      metadata: { amount, currency, transactionId },
    });
    await this.enqueueDelivery(
      `EMAIL:WITHDRAWAL_REQUESTED:${transactionId ?? notification.id}`,
      {
        channel: NotificationChannel.EMAIL,
        notificationId: notification.id,
        userId,
        template: 'transaction',
        transactionKind: 'withdrawal_request',
        amount,
        currency,
        details: { reference: transactionId },
      } as Prisma.InputJsonValue,
      notification.id,
    );
    return notification;
  }

  /**
   * Notify user of withdrawal completion.
   */
  async notifyWithdrawalCompleted(
    userId: string,
    amount: string,
    currency: string,
    transactionId?: string,
  ): Promise<NotificationResponse> {
    const notification = await this.createNotification({
      userId,
      type: NotificationType.WITHDRAWAL_COMPLETED,
      title: 'Withdrawal Completed',
      message: `Your withdrawal of ${currency} ${amount} has been completed successfully.`,
      link: '/dashboard/wallet',
      metadata: { amount, currency, transactionId },
    });
    await this.enqueueDelivery(
      `EMAIL:WITHDRAWAL_COMPLETED:${transactionId ?? notification.id}`,
      {
        channel: NotificationChannel.EMAIL,
        notificationId: notification.id,
        userId,
        template: 'transaction',
        transactionKind: 'withdrawal_success',
        amount,
        currency,
        details: { reference: transactionId },
      } as Prisma.InputJsonValue,
      notification.id,
    );
    return notification;
  }

  /**
   * Notify user of withdrawal failure.
   */
  async notifyWithdrawalFailed(
    userId: string,
    amount: string,
    currency: string,
    reason?: string,
    transactionId?: string,
  ): Promise<NotificationResponse> {
    const notification = await this.createNotification({
      userId,
      type: NotificationType.WITHDRAWAL_FAILED,
      title: 'Withdrawal Failed',
      message: reason
        ? `Your withdrawal of ${currency} ${amount} failed: ${reason}`
        : `Your withdrawal of ${currency} ${amount} could not be processed. Please try again or contact support.`,
      link: '/dashboard/wallet',
      metadata: { amount, currency, transactionId, reason },
    });
    await this.enqueueDelivery(
      `EMAIL:WITHDRAWAL_FAILED:${transactionId ?? notification.id}`,
      {
        channel: NotificationChannel.EMAIL,
        notificationId: notification.id,
        userId,
        template: 'transaction',
        transactionKind: 'withdrawal_failure',
        amount,
        currency,
        details: { reference: transactionId, reason: reason ?? null },
      } as Prisma.InputJsonValue,
      notification.id,
    );
    return notification;
  }

  /**
   * Notify user of KYC approval.
   */
  async notifyKycApproved(userId: string): Promise<NotificationResponse> {
    const notification = await this.createNotification({
      userId,
      type: NotificationType.KYC_APPROVED,
      title: 'KYC Approved',
      message: 'Your identity verification has been approved. You can now access all features.',
      link: '/dashboard/account',
    });
    await this.enqueueDelivery(
      `EMAIL:KYC_APPROVED:${userId}:${notification.id}`,
      {
        channel: NotificationChannel.EMAIL,
        notificationId: notification.id,
        userId,
        template: 'kyc',
        kycStatus: 'approved',
      } as Prisma.InputJsonValue,
      notification.id,
    );
    return notification;
  }

  /**
   * Notify user of KYC rejection.
   */
  async notifyKycRejected(userId: string, reason?: string): Promise<NotificationResponse> {
    const safeReason = this.sanitizeReason(reason);
    const notification = await this.createNotification({
      userId,
      type: NotificationType.KYC_REJECTED,
      title: 'KYC Verification Failed',
      message: safeReason
        ? `Your identity verification was not approved: ${safeReason}. Please update your documents.`
        : 'Your identity verification was not approved. Please review your documents and try again.',
      link: '/dashboard/account/kyc',
      metadata: { reason: safeReason },
    });
    await this.enqueueDelivery(
      `EMAIL:KYC_REJECTED:${userId}:${notification.id}`,
      {
        channel: NotificationChannel.EMAIL,
        notificationId: notification.id,
        userId,
        template: 'kyc',
        kycStatus: 'rejected',
        kycReason: safeReason,
      } as Prisma.InputJsonValue,
      notification.id,
    );
    return notification;
  }

  /**
   * Notify user KYC requires manual review.
   */
  async notifyKycRequiresReview(userId: string): Promise<NotificationResponse> {
    return this.createNotification({
      userId,
      type: NotificationType.KYC_REQUIRES_REVIEW,
      title: 'KYC Under Review',
      message: 'Your identity verification requires additional review. We will notify you once complete.',
      link: '/dashboard/account/kyc',
    });
  }

  /**
   * Notify user of ROI credit.
   */
  async notifyRoiCredited(
    userId: string,
    propertyTitle: string,
    amount: string,
    currency: string,
    period: string,
  ): Promise<NotificationResponse> {
    const notification = await this.createNotification({
      userId,
      type: NotificationType.ROI_CREDITED,
      title: 'Returns Credited',
      message: `You earned ${currency} ${amount} in returns from ${propertyTitle} for ${period}.`,
      link: '/dashboard/investments',
      metadata: { propertyTitle, amount, currency, period },
    });
    await this.enqueueDelivery(
      `EMAIL:ROI_CREDITED:${userId}:${period}:${notification.id}`,
      {
        channel: NotificationChannel.EMAIL,
        notificationId: notification.id,
        userId,
        template: 'transaction',
        transactionKind: 'roi_payout',
        amount,
        currency,
        details: { reference: period, propertyTitle },
      } as Prisma.InputJsonValue,
      notification.id,
    );
    return notification;
  }

  /**
   * Notify user of property update.
   */
  async notifyPropertyUpdate(
    userId: string,
    propertyTitle: string,
    updateMessage: string,
    propertyId: string,
  ): Promise<NotificationResponse> {
    return this.createNotification({
      userId,
      type: NotificationType.PROPERTY_UPDATE,
      title: 'Property Update',
      message: `${propertyTitle}: ${updateMessage}`,
      link: `/dashboard/properties/${propertyId}`,
      metadata: { propertyId, propertyTitle },
    });
  }

  /**
   * Send a system message to a user.
   */
  async notifySystemMessage(
    userId: string,
    title: string,
    message: string,
    link?: string,
    metadata?: Prisma.InputJsonValue,
  ): Promise<NotificationResponse> {
    return this.createNotification({
      userId,
      type: NotificationType.SYSTEM_MESSAGE,
      title,
      message,
      link,
      metadata,
    });
  }

  async notifyWithdrawalReconciliationRequired(
    userId: string,
    amount: string,
    currency: string,
    transactionId: string,
    reason?: string,
  ): Promise<NotificationResponse> {
    return this.notifySystemMessage(
      userId,
      'Withdrawal requires reconciliation',
      reason
        ? `Your withdrawal of ${currency} ${amount} requires manual reconciliation: ${this.sanitizeReason(reason)}`
        : `Your withdrawal of ${currency} ${amount} requires manual reconciliation.`,
      '/dashboard/wallet',
      {
        event: 'WITHDRAWAL_RECONCILIATION_REQUIRED',
        amount,
        currency,
        transactionId,
      } as Prisma.InputJsonValue,
    );
  }

  async notifyVirtualAccountProvisioned(
    userId: string,
    accountId: string,
    accountNumber: string | null,
  ): Promise<NotificationResponse> {
    return this.notifySystemMessage(
      userId,
      'Virtual account ready',
      accountNumber
        ? `Your virtual account ${accountNumber} is active and ready for wallet funding.`
        : 'Your virtual account is active and ready for wallet funding.',
      '/dashboard/wallet',
      {
        event: 'VIRTUAL_ACCOUNT_ACTIVE',
        accountId,
        accountNumber,
      } as Prisma.InputJsonValue,
    );
  }

  async notifyVirtualAccountProvisioningFailed(
    userId: string,
    accountId: string,
    reason?: string | null,
  ): Promise<NotificationResponse> {
    return this.notifySystemMessage(
      userId,
      'Virtual account provisioning failed',
      reason
        ? `We could not provision your virtual account yet: ${this.sanitizeReason(reason) ?? 'Unknown reason'}. Please retry shortly.`
        : 'We could not provision your virtual account yet. Please retry shortly.',
      '/dashboard/wallet',
      {
        event: 'VIRTUAL_ACCOUNT_PROVISIONING_FAILED',
        accountId,
        reason: this.sanitizeReason(reason ?? undefined) ?? null,
      } as Prisma.InputJsonValue,
    );
  }

  /**
   * Send welcome notification to new user.
   */
  async notifyWelcome(userId: string, firstName?: string): Promise<NotificationResponse> {
    const name = firstName ? `, ${firstName}` : '';
    const notification = await this.createNotification({
      userId,
      type: NotificationType.WELCOME,
      title: 'Welcome to Cohold!',
      message: `Welcome${name}! Complete your profile and start investing in premium real estate.`,
      link: '/dashboard',
    });
    await this.enqueueDelivery(
      `EMAIL:WELCOME:${userId}`,
      {
        channel: NotificationChannel.EMAIL,
        notificationId: notification.id,
        userId,
        template: 'welcome',
        firstName,
      } as Prisma.InputJsonValue,
      notification.id,
    );
    return notification;
  }

  /**
   * Notify recipient that they received a P2P transfer.
   */
  async notifyIncomingP2PReceived(
    userId: string,
    amount: string,
    currency: string,
    senderUsername: string,
    transferId: string,
  ): Promise<NotificationResponse> {
    const notification = await this.createNotification({
      userId,
      type: NotificationType.SYSTEM_MESSAGE,
      title: 'Money Received',
      message: `You received ${currency} ${amount} from @${senderUsername}.`,
      link: `/dashboard/wallets/p2p/success?id=${transferId}`,
      metadata: {
        transferId,
        amount,
        currency,
        senderUsername,
        event: 'P2P_INCOMING',
      },
    });
    await this.enqueueDelivery(
      `EMAIL:P2P_INCOMING:${transferId}`,
      {
        channel: NotificationChannel.EMAIL,
        notificationId: notification.id,
        userId,
        template: 'transaction',
        transactionKind: 'transfer_incoming',
        amount,
        currency,
        details: { reference: transferId, senderUsername },
      } as Prisma.InputJsonValue,
      notification.id,
    );
    return notification;
  }

  async notifyOutgoingP2PSent(
    userId: string,
    amount: string,
    currency: string,
    recipientUsername: string,
    transferId: string,
  ): Promise<NotificationResponse> {
    const notification = await this.createNotification({
      userId,
      type: NotificationType.SYSTEM_MESSAGE,
      title: 'Transfer Sent',
      message: `You sent ${currency} ${amount} to @${recipientUsername}.`,
      link: `/dashboard/wallets/p2p/success?id=${transferId}`,
      metadata: {
        transferId,
        amount,
        currency,
        recipientUsername,
        event: 'P2P_OUTGOING',
      },
    });
    await this.enqueueDelivery(
      `EMAIL:P2P_OUTGOING:${transferId}`,
      {
        channel: NotificationChannel.EMAIL,
        notificationId: notification.id,
        userId,
        template: 'transaction',
        transactionKind: 'transfer_outgoing',
        amount,
        currency,
        details: { reference: transferId, recipientUsername },
      } as Prisma.InputJsonValue,
      notification.id,
    );
    return notification;
  }

  /**
   * Generic wallet credit helper for non-card/non-P2P credit events.
   */
  async notifyWalletCredited(
    userId: string,
    amount: string,
    currency: string,
    reason: string,
    referenceId?: string,
    link = '/dashboard/wallet',
  ): Promise<NotificationResponse> {
    const notification = await this.createNotification({
      userId,
      type: NotificationType.SYSTEM_MESSAGE,
      title: 'Wallet Credited',
      message: `Your wallet was credited with ${currency} ${amount}${reason ? ` (${reason})` : ''}.`,
      link,
      metadata: {
        amount,
        currency,
        reason,
        referenceId: referenceId ?? null,
        event: 'WALLET_CREDIT',
      },
    });
    await this.enqueueDelivery(
      `EMAIL:WALLET_CREDIT:${referenceId ?? notification.id}`,
      {
        channel: NotificationChannel.EMAIL,
        notificationId: notification.id,
        userId,
        template: 'transaction',
        transactionKind: 'deposit',
        amount,
        currency,
        details: { reference: referenceId, reason },
      } as Prisma.InputJsonValue,
      notification.id,
    );
    return notification;
  }

  /**
   * Alias for admin/system credits.
   */
  async notifySystemCredit(
    userId: string,
    amount: string,
    currency: string,
    reason: string,
    referenceId?: string,
  ): Promise<NotificationResponse> {
    return this.notifyWalletCredited(userId, amount, currency, reason, referenceId);
  }

  /**
   * Broadcast a system message to multiple users.
   */
  async broadcastSystemMessage(
    userIds: string[],
    title: string,
    message: string,
    link?: string,
    metadata?: Prisma.InputJsonValue,
  ): Promise<{ createdCount: number }> {
    const payloads: CreateNotificationPayload[] = userIds.map((userId) => ({
      userId,
      type: NotificationType.SYSTEM_MESSAGE,
      title,
      message,
      link,
      metadata,
    }));

    return this.createManyNotifications(payloads);
  }
}
