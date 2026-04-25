import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { Server, Socket } from 'socket.io';
import { getAccessTokenFromHandshake } from '../../common/ws/handshake-access-token';

@WebSocketGateway({
  namespace: '/ws/user',
  cors: { origin: '*', credentials: true },
})
export class UserGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const token = getAccessTokenFromHandshake(client);
    if (!token || typeof token !== 'string') {
      client.disconnect(true);
      return;
    }

    try {
      const secret = this.configService.get<string>('config.jwt.accessSecret');
      if (!secret) {
        client.disconnect(true);
        return;
      }
      const payload = await this.jwtService.verifyAsync<{ sub: string; role?: string }>(token, {
        secret,
      });
      if (payload.role !== 'user') {
        client.disconnect(true);
        return;
      }
      const userId = payload.sub as string;
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { emailVerifiedAt: true, isFrozen: true },
      });
      if (!user || user.isFrozen || !user.emailVerifiedAt) {
        client.disconnect(true);
        return;
      }
      client.join(`user:${userId}`);
    } catch {
      client.disconnect(true);
    }
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket, @MessageBody() _data: any) {
    client.emit('pong', { ts: Date.now() });
  }

  // Example method to broadcast KYC status updates:
  notifyKycStatus(userId: string, status: string) {
    this.server.to(`user:${userId}`).emit('kyc-status', { status });
  }
}

