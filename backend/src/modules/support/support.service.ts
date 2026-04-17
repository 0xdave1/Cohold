import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  Prisma,
  SupportCategory,
  SupportMessageType,
  SupportSenderType,
  SupportStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { generateSupportReferenceCode } from './helpers/reference-code';
import { triageGreeting } from './helpers/triage';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async isAnySupportAdminOnline(): Promise<boolean> {
    const count = await this.prisma.supportPresence.count({
      where: {
        isOnline: true,
        admin: {
          OR: [{ canSupport: true }, { role: 'SUPER_ADMIN' }],
        },
      },
    });
    return count > 0;
  }

  async createConversation(params: {
    userId: string;
    category: SupportCategory;
    subject?: string | null;
    priority?: Prisma.SupportConversationCreateInput['priority'];
    metadata?: Prisma.JsonValue;
  }) {
    const online = await this.isAnySupportAdminOnline();
    const triage = triageGreeting(params.category, online);

    const referenceCode = generateSupportReferenceCode();
    const now = new Date();

    const status: SupportStatus = online ? SupportStatus.OPEN : SupportStatus.WAITING_FOR_ADMIN;

    const conv = await this.prisma.supportConversation.create({
      data: {
        referenceCode,
        userId: params.userId,
        category: params.category,
        status,
        priority: (params.priority as any) ?? undefined,
        isDispute: triage.isDispute,
        subject: params.subject ?? null,
        metadata: params.metadata ?? undefined,
        lastMessageAt: now,
        messages: {
          create: [
            {
              senderType: SupportSenderType.BOT,
              content: triage.greeting,
              messageType: SupportMessageType.TEXT,
              createdAt: now,
            },
            {
              senderType: SupportSenderType.BOT,
              content: triage.nextPrompt,
              messageType: SupportMessageType.TEXT,
              createdAt: now,
            },
          ],
        },
      },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    return conv;
  }

  async listUserConversations(userId: string) {
    return this.prisma.supportConversation.findMany({
      where: { userId },
      orderBy: { lastMessageAt: 'desc' },
      select: {
        id: true,
        referenceCode: true,
        category: true,
        status: true,
        priority: true,
        isDispute: true,
        subject: true,
        lastMessageAt: true,
        createdAt: true,
        updatedAt: true,
        assignedAdminId: true,
      },
    });
  }

  async getUserConversation(userId: string, conversationId: string) {
    const conv = await this.prisma.supportConversation.findFirst({
      where: { id: conversationId, userId },
      select: {
        id: true,
        referenceCode: true,
        category: true,
        status: true,
        priority: true,
        isDispute: true,
        subject: true,
        metadata: true,
        lastMessageAt: true,
        createdAt: true,
        updatedAt: true,
        assignedAdminId: true,
      },
    });
    if (!conv) throw new NotFoundException('Conversation not found');
    return conv;
  }

  async listConversationMessagesForUser(userId: string, conversationId: string, page = 1, limit = 50) {
    const conv = await this.prisma.supportConversation.findFirst({
      where: { id: conversationId, userId },
      select: { id: true },
    });
    if (!conv) throw new NotFoundException('Conversation not found');

    // Opening a thread marks unread admin replies as read.
    await this.prisma.supportMessage.updateMany({
      where: {
        conversationId,
        senderType: SupportSenderType.ADMIN,
        readAt: null,
      },
      data: { readAt: new Date() },
    });

    const skip = (page - 1) * limit;
    const where: Prisma.SupportMessageWhereInput = {
      conversationId,
      messageType: { not: SupportMessageType.INTERNAL_NOTE },
    };

    const [items, total] = await Promise.all([
      this.prisma.supportMessage.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'asc' },
        include: { attachments: true },
      }),
      this.prisma.supportMessage.count({ where }),
    ]);

    return { items, meta: { page, limit, total } };
  }

  async getUserUnreadCount(userId: string): Promise<{ unreadCount: number }> {
    const unreadCount = await this.prisma.supportMessage.count({
      where: {
        senderType: SupportSenderType.ADMIN,
        readAt: null,
        conversation: { userId },
      },
    });
    return { unreadCount };
  }

  async markConversationAsRead(userId: string, conversationId: string): Promise<{ markedCount: number }> {
    const conv = await this.prisma.supportConversation.findFirst({
      where: { id: conversationId, userId },
      select: { id: true },
    });
    if (!conv) throw new NotFoundException('Conversation not found');

    const result = await this.prisma.supportMessage.updateMany({
      where: {
        conversationId,
        senderType: SupportSenderType.ADMIN,
        readAt: null,
      },
      data: { readAt: new Date() },
    });
    return { markedCount: result.count };
  }

  async markAllAsRead(userId: string): Promise<{ markedCount: number }> {
    const result = await this.prisma.supportMessage.updateMany({
      where: {
        senderType: SupportSenderType.ADMIN,
        readAt: null,
        conversation: { userId },
      },
      data: { readAt: new Date() },
    });
    return { markedCount: result.count };
  }

  async sendUserMessage(userId: string, conversationId: string, content: string, metadata?: Prisma.JsonValue) {
    if (!content.trim()) throw new BadRequestException('Message content is required');

    const conv = await this.prisma.supportConversation.findFirst({
      where: { id: conversationId, userId },
      select: { id: true, status: true },
    });
    if (!conv) throw new NotFoundException('Conversation not found');

    const now = new Date();

    const metaObj = (metadata ?? undefined) as any;
    const msgId: string | undefined = typeof metaObj?.messageId === 'string' ? metaObj.messageId : undefined;
    const attachments: Array<{ storageKey: string; mimeType: string; sizeBytes: number; fileName?: string }> =
      Array.isArray(metaObj?.attachments) ? metaObj.attachments : [];

    const msg = await this.prisma.supportMessage.create({
      data: {
        ...(msgId ? { id: msgId } : {}),
        conversationId,
        senderType: SupportSenderType.USER,
        senderUserId: userId,
        content,
        messageType: SupportMessageType.TEXT,
        metadata: metadata ?? undefined,
        createdAt: now,
        attachments:
          attachments.length > 0
            ? {
                create: attachments.map((a) => ({
                  storageKey: String(a.storageKey),
                  mimeType: String(a.mimeType),
                  sizeBytes: Number(a.sizeBytes) || 0,
                  fileName: a.fileName ? String(a.fileName) : null,
                })),
              }
            : undefined,
      },
      include: { attachments: true },
    });

    const nextStatus =
      conv.status === SupportStatus.RESOLVED || conv.status === SupportStatus.CLOSED
        ? SupportStatus.OPEN
        : SupportStatus.WAITING_FOR_ADMIN;

    await this.prisma.supportConversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: now, status: nextStatus },
    });

    return msg;
  }

  // ---------------- Admin ----------------

  async listAdminConversations(adminId: string, filters: {
    status?: SupportStatus;
    category?: SupportCategory;
    assigned?: 'me' | 'unassigned' | 'all';
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.SupportConversationWhereInput = {};
    if (filters.status) where.status = filters.status;
    if (filters.category) where.category = filters.category;
    if (filters.assigned === 'me') where.assignedAdminId = adminId;
    if (filters.assigned === 'unassigned') where.assignedAdminId = null;
    if (filters.search?.trim()) {
      const q = filters.search.trim();
      where.OR = [
        { referenceCode: { contains: q, mode: 'insensitive' } },
        { subject: { contains: q, mode: 'insensitive' } },
        { user: { email: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.supportConversation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { lastMessageAt: 'desc' },
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
          assignedAdmin: { select: { id: true, email: true, fullName: true } },
        },
      }),
      this.prisma.supportConversation.count({ where }),
    ]);

    return { items, meta: { page, limit, total } };
  }

  async getAdminConversation(conversationId: string) {
    const conv = await this.prisma.supportConversation.findUnique({
      where: { id: conversationId },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
        assignedAdmin: { select: { id: true, email: true, fullName: true } },
      },
    });
    if (!conv) throw new NotFoundException('Conversation not found');
    return conv;
  }

  async listConversationMessagesForAdmin(conversationId: string, page = 1, limit = 50) {
    const conv = await this.prisma.supportConversation.findUnique({
      where: { id: conversationId },
      select: { id: true },
    });
    if (!conv) throw new NotFoundException('Conversation not found');

    const skip = (page - 1) * limit;
    const where: Prisma.SupportMessageWhereInput = { conversationId };
    const [items, total] = await Promise.all([
      this.prisma.supportMessage.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'asc' },
        include: { attachments: true },
      }),
      this.prisma.supportMessage.count({ where }),
    ]);
    return { items, meta: { page, limit, total } };
  }

  async sendAdminMessage(adminId: string, conversationId: string, content: string, metadata?: Prisma.JsonValue) {
    if (!content.trim()) throw new BadRequestException('Message content is required');
    const conversation = await this.prisma.supportConversation.findUniqueOrThrow({
      where: { id: conversationId },
      select: { id: true, userId: true },
    });
    const now = new Date();
    const metaObj = (metadata ?? undefined) as any;
    const msgId: string | undefined = typeof metaObj?.messageId === 'string' ? metaObj.messageId : undefined;
    const attachments: Array<{ storageKey: string; mimeType: string; sizeBytes: number; fileName?: string }> =
      Array.isArray(metaObj?.attachments) ? metaObj.attachments : [];

    const msg = await this.prisma.supportMessage.create({
      data: {
        ...(msgId ? { id: msgId } : {}),
        conversationId,
        senderType: SupportSenderType.ADMIN,
        senderAdminId: adminId,
        content,
        messageType: SupportMessageType.TEXT,
        metadata: metadata ?? undefined,
        createdAt: now,
        attachments:
          attachments.length > 0
            ? {
                create: attachments.map((a) => ({
                  storageKey: String(a.storageKey),
                  mimeType: String(a.mimeType),
                  sizeBytes: Number(a.sizeBytes) || 0,
                  fileName: a.fileName ? String(a.fileName) : null,
                })),
              }
            : undefined,
      },
      include: { attachments: true },
    });
    await this.prisma.supportConversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: now, status: SupportStatus.WAITING_FOR_USER },
    });

    // Optional notification entry for admin reply (non-blocking).
    try {
      await this.notificationsService.notifySystemMessage(
        conversation.userId,
        'New support reply',
        content.length > 140 ? `${content.slice(0, 137)}...` : content,
        '/dashboard/support',
        { conversationId, supportMessageId: msg.id, event: 'SUPPORT_REPLY' },
      );
    } catch (err) {
      this.logger.warn(
        `Failed support reply notification conversation=${conversationId} user=${conversation.userId}: ${err}`,
      );
    }

    return msg;
  }

  async addInternalNote(adminId: string, conversationId: string, content: string, metadata?: Prisma.JsonValue) {
    if (!content.trim()) throw new BadRequestException('Note content is required');
    await this.prisma.supportConversation.findUniqueOrThrow({ where: { id: conversationId } });
    const now = new Date();
    const msg = await this.prisma.supportMessage.create({
      data: {
        conversationId,
        senderType: SupportSenderType.ADMIN,
        senderAdminId: adminId,
        content,
        messageType: SupportMessageType.INTERNAL_NOTE,
        metadata: metadata ?? undefined,
        createdAt: now,
      },
    });
    return msg;
  }

  async assignConversation(actorAdminId: string, conversationId: string, assignedAdminId: string) {
    const now = new Date();
    const updated = await this.prisma.supportConversation.update({
      where: { id: conversationId },
      data: { assignedAdminId },
    });
    await this.prisma.supportMessage.create({
      data: {
        conversationId,
        senderType: SupportSenderType.SYSTEM,
        content: `Conversation assigned`,
        messageType: SupportMessageType.SYSTEM_EVENT,
        metadata: { assignedAdminId, actorAdminId } as any,
        createdAt: now,
      },
    });
    return updated;
  }

  async resolveConversation(actorAdminId: string, conversationId: string) {
    const now = new Date();
    const updated = await this.prisma.supportConversation.update({
      where: { id: conversationId },
      data: { status: SupportStatus.RESOLVED },
    });
    await this.prisma.supportMessage.create({
      data: {
        conversationId,
        senderType: SupportSenderType.SYSTEM,
        content: `Conversation resolved`,
        messageType: SupportMessageType.SYSTEM_EVENT,
        metadata: { actorAdminId } as any,
        createdAt: now,
      },
    });
    return updated;
  }

  async setPresence(adminId: string, isOnline: boolean) {
    const now = new Date();
    return this.prisma.supportPresence.upsert({
      where: { adminId },
      update: { isOnline, lastSeenAt: now },
      create: { adminId, isOnline, lastSeenAt: now },
    });
  }

  async listOnlineSupportAdmins() {
    return this.prisma.supportPresence.findMany({
      where: { isOnline: true },
      orderBy: { updatedAt: 'desc' },
      include: { admin: { select: { id: true, email: true, fullName: true } } },
    });
  }
}

