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
  namespace: '/ws/admin',
  cors: { origin: '*', credentials: true },
})
export class AdminGateway implements OnGatewayConnection {
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
      const adminId = payload.sub as string;
      client.join(`admin:${adminId}`);
      client.join('admin:all');
    } catch {
      client.disconnect(true);
    }
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket, @MessageBody() _data: any) {
    client.emit('pong', { ts: Date.now() });
  }

  // Example to notify admins of alerts
  notifyAlert(alert: { type: string; message: string }) {
    this.server.to('admin:all').emit('alert', alert);
  }
}

