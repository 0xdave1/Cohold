import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { PrismaService } from '../../prisma/prisma.service';
import { Server, Socket } from 'socket.io';
import { SupportMessageType, SupportSenderType, SupportStatus } from '@prisma/client';
import { getAccessTokenFromHandshake } from '../../common/ws/handshake-access-token';
import { WsAuthTokenVerifier } from '../../common/ws/ws-auth-token.verifier';
import { wsCorsOptions } from '../../common/ws/ws-cors-origins';

type AuthedSocket = Socket & {
  data: {
    actorType?: 'user' | 'admin';
    actorId?: string;
    canSupport?: boolean;
  };
};

@WebSocketGateway({
  namespace: '/ws/support',
  cors: wsCorsOptions(),
})
export class SupportGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly prisma: PrismaService,
    private readonly wsAuth: WsAuthTokenVerifier,
  ) {}

  async handleConnection(client: AuthedSocket): Promise<void> {
    const token = getAccessTokenFromHandshake(client);
    if (!token) {
      client.disconnect(true);
      return;
    }

    const actor = await this.wsAuth.verifySupportAccessSocket(token);
    if (!actor) {
      client.disconnect(true);
      return;
    }

    if (actor.kind === 'user') {
      client.data.actorId = actor.userId;
      client.data.actorType = 'user';
      client.join(`user:${actor.userId}`);
      return;
    }

    client.data.actorId = actor.adminId;
    client.data.actorType = 'admin';
    client.data.canSupport = actor.canSupport;
    client.join(`admin:${actor.adminId}`);
    client.join('support:agents');
  }

  @SubscribeMessage('support:ping')
  handlePing(@ConnectedSocket() client: AuthedSocket, @MessageBody() _data: any) {
    client.emit('support:pong', { ts: Date.now() });
  }

  @SubscribeMessage('support:presence.set')
  async setPresence(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: { isOnline: boolean },
  ) {
    if (client.data.actorType !== 'admin' || !client.data.actorId || !client.data.canSupport) {
      client.emit('support:error', { message: 'Not authorized' });
      return;
    }
    const now = new Date();
    const presence = await this.prisma.supportPresence.upsert({
      where: { adminId: client.data.actorId },
      update: { isOnline: !!data?.isOnline, lastSeenAt: now },
      create: { adminId: client.data.actorId, isOnline: !!data?.isOnline, lastSeenAt: now },
    });
    const payload = { adminId: presence.adminId, isOnline: presence.isOnline, lastSeenAt: presence.lastSeenAt };
    this.server.to('support:agents').emit('support:presence.update', payload);
    this.server.emit('support:presence.update', payload);
    return payload;
  }

  @SubscribeMessage('support:conversation.join')
  async joinConversation(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    const conversationId = data?.conversationId;
    if (!conversationId) return;

    const conv = await this.prisma.supportConversation.findUnique({
      where: { id: conversationId },
      select: { id: true, userId: true },
    });
    if (!conv) return;

    if (client.data.actorType === 'user') {
      if (client.data.actorId !== conv.userId) return;
      client.join(`support:conversation:${conversationId}`);
      return;
    }

    if (client.data.actorType === 'admin' && client.data.canSupport) {
      client.join(`support:conversation:${conversationId}`);
      return;
    }
  }

  @SubscribeMessage('support:conversation.leave')
  leaveConversation(@ConnectedSocket() client: AuthedSocket, @MessageBody() data: { conversationId: string }) {
    const conversationId = data?.conversationId;
    if (!conversationId) return;
    client.leave(`support:conversation:${conversationId}`);
  }

  @SubscribeMessage('support:message.send')
  async sendMessage(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody()
    data: {
      conversationId: string;
      content: string;
      messageId?: string;
      attachments?: Array<{ storageKey: string; mimeType: string; sizeBytes: number; fileName?: string }>;
      metadata?: Record<string, unknown>;
    },
  ) {
    const conversationId = data?.conversationId;
    const content = (data?.content ?? '').trim();
    if (!conversationId || !content) return;

    const conv = await this.prisma.supportConversation.findUnique({
      where: { id: conversationId },
      select: { id: true, userId: true, status: true },
    });
    if (!conv) return;

    const now = new Date();

    if (client.data.actorType === 'user') {
      if (client.data.actorId !== conv.userId) return;
      const msg = await this.prisma.supportMessage.create({
        data: {
          ...(typeof data.messageId === 'string' ? { id: data.messageId } : {}),
          conversationId,
          senderType: SupportSenderType.USER,
          senderUserId: conv.userId,
          content,
          messageType: SupportMessageType.TEXT,
          metadata: (data.metadata ?? undefined) as any,
          createdAt: now,
          attachments:
            Array.isArray(data.attachments) && data.attachments.length > 0
              ? {
                  create: data.attachments.map((a) => ({
                    storageKey: String(a.storageKey),
                    mimeType: String(a.mimeType),
                    sizeBytes: Number(a.sizeBytes) || 0,
                    fileName: a.fileName ? String(a.fileName) : null,
                  })),
                }
              : undefined,
        },
      });
      await this.prisma.supportConversation.update({
        where: { id: conversationId },
        data: {
          lastMessageAt: now,
          status:
            conv.status === SupportStatus.RESOLVED || conv.status === SupportStatus.CLOSED
              ? SupportStatus.OPEN
              : SupportStatus.WAITING_FOR_ADMIN,
        },
      });
      const payload = { ...msg, createdAt: msg.createdAt.toISOString() };
      this.server.to(`support:conversation:${conversationId}`).emit('support:message.new', payload);
      this.server.to(`user:${conv.userId}`).emit('support:message.new', payload);
      this.server.to('support:agents').emit('support:message.new', payload);
      return payload;
    }

    if (client.data.actorType === 'admin' && client.data.actorId && client.data.canSupport) {
      const msg = await this.prisma.supportMessage.create({
        data: {
          ...(typeof data.messageId === 'string' ? { id: data.messageId } : {}),
          conversationId,
          senderType: SupportSenderType.ADMIN,
          senderAdminId: client.data.actorId,
          content,
          messageType: SupportMessageType.TEXT,
          metadata: (data.metadata ?? undefined) as any,
          createdAt: now,
          attachments:
            Array.isArray(data.attachments) && data.attachments.length > 0
              ? {
                  create: data.attachments.map((a) => ({
                    storageKey: String(a.storageKey),
                    mimeType: String(a.mimeType),
                    sizeBytes: Number(a.sizeBytes) || 0,
                    fileName: a.fileName ? String(a.fileName) : null,
                  })),
                }
              : undefined,
        },
      });
      await this.prisma.supportConversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: now, status: SupportStatus.WAITING_FOR_USER },
      });
      const payload = { ...msg, createdAt: msg.createdAt.toISOString() };
      this.server.to(`support:conversation:${conversationId}`).emit('support:message.new', payload);
      this.server.to(`user:${conv.userId}`).emit('support:message.new', payload);
      this.server.to('support:agents').emit('support:message.new', payload);
      return payload;
    }
  }

  @SubscribeMessage('support:typing')
  typing(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: { conversationId: string; isTyping: boolean },
  ) {
    const conversationId = data?.conversationId;
    if (!conversationId || !client.data.actorType || !client.data.actorId) return;
    this.server.to(`support:conversation:${conversationId}`).emit('support:typing', {
      conversationId,
      actorType: client.data.actorType,
      actorId: client.data.actorId,
      isTyping: !!data.isTyping,
      ts: Date.now(),
    });
  }
}
