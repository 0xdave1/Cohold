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
import { Server, Socket } from 'socket.io';

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
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const token = client.handshake.auth?.token ?? client.handshake.query?.token;
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
      const payload = await this.jwtService.verifyAsync(token, { secret });
      const userId = payload.sub as string;
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

