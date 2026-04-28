import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationType, Prisma } from '@prisma/client';
import { EmailService } from '../email/email.service';

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
    private readonly emailService: EmailService,
  ) {}

  private async trySendEmail(
    userId: string,
    send: (email: string) => Promise<void>,
    context: string,
  ): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      if (!user?.email) return;
      await send(user.email);
    } catch (err) {
      this.logger.warn(`Failed email side-effect context=${context} user=${userId}: ${err}`);
    }
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
    await this.trySendEmail(
      userId,
      (email) =>
        this.emailService.sendTransactionEmail(email, 'investment_success', amount, currency, {
          reference: investmentId,
          propertyTitle,
        }),
      'investment_success',
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
    await this.trySendEmail(
      userId,
      (email) =>
        this.emailService.sendTransactionEmail(email, 'investment_sale', amount, currency, {
          reference: investmentId,
          propertyTitle,
        }),
      'investment_sale',
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
    await this.trySendEmail(
      userId,
      (email) =>
        this.emailService.sendTransactionEmail(email, 'deposit', amount, currency, {
          reference: transactionId,
        }),
      'wallet_funded',
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
    await this.trySendEmail(
      userId,
      (email) =>
        this.emailService.sendTransactionEmail(email, 'withdrawal_request', amount, currency, {
          reference: transactionId,
        }),
      'withdrawal_initiated',
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
    await this.trySendEmail(
      userId,
      (email) =>
        this.emailService.sendTransactionEmail(email, 'withdrawal_success', amount, currency, {
          reference: transactionId,
        }),
      'withdrawal_completed',
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
    await this.trySendEmail(
      userId,
      (email) =>
        this.emailService.sendTransactionEmail(email, 'withdrawal_failure', amount, currency, {
          reference: transactionId,
          reason: reason ?? null,
        }),
      'withdrawal_failed',
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
    await this.trySendEmail(
      userId,
      (email) => this.emailService.sendKycStatusEmail(email, 'approved'),
      'kyc_approved',
    );
    return notification;
  }

  /**
   * Notify user of KYC rejection.
   */
  async notifyKycRejected(userId: string, reason?: string): Promise<NotificationResponse> {
    const notification = await this.createNotification({
      userId,
      type: NotificationType.KYC_REJECTED,
      title: 'KYC Verification Failed',
      message: reason
        ? `Your identity verification was not approved: ${reason}. Please update your documents.`
        : 'Your identity verification was not approved. Please review your documents and try again.',
      link: '/dashboard/account/kyc',
      metadata: { reason },
    });
    await this.trySendEmail(
      userId,
      (email) => this.emailService.sendKycStatusEmail(email, 'rejected', reason),
      'kyc_rejected',
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
    await this.trySendEmail(
      userId,
      (email) =>
        this.emailService.sendTransactionEmail(email, 'roi_payout', amount, currency, {
          reference: period,
          propertyTitle,
        }),
      'roi_credited',
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
    await this.trySendEmail(
      userId,
      (email) => this.emailService.sendWelcomeEmail(email, firstName),
      'welcome',
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
    await this.trySendEmail(
      userId,
      (email) =>
        this.emailService.sendTransactionEmail(email, 'transfer_incoming', amount, currency, {
          reference: transferId,
          senderUsername,
        }),
      'p2p_incoming',
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
    await this.trySendEmail(
      userId,
      (email) =>
        this.emailService.sendTransactionEmail(email, 'transfer_outgoing', amount, currency, {
          reference: transferId,
          recipientUsername,
        }),
      'p2p_outgoing',
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
    await this.trySendEmail(
      userId,
      (email) =>
        this.emailService.sendTransactionEmail(email, 'deposit', amount, currency, {
          reference: referenceId,
          reason,
        }),
      'wallet_credited',
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
