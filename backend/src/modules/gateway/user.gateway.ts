import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { getAccessTokenFromHandshake } from '../../common/ws/handshake-access-token';
import { WsAuthTokenVerifier } from '../../common/ws/ws-auth-token.verifier';
import { wsCorsOptions } from '../../common/ws/ws-cors-origins';

@WebSocketGateway({
  namespace: '/ws/user',
  cors: wsCorsOptions(),
})
export class UserGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly wsAuth: WsAuthTokenVerifier) {}

  async handleConnection(client: Socket): Promise<void> {
    const token = getAccessTokenFromHandshake(client);
    if (!token) {
      client.disconnect(true);
      return;
    }
    const userId = await this.wsAuth.verifyUserAccessSocket(token);
    if (!userId) {
      client.disconnect(true);
      return;
    }
    client.join(`user:${userId}`);
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket, @MessageBody() _data: any) {
    client.emit('pong', { ts: Date.now() });
  }

  notifyKycStatus(userId: string, status: string) {
    this.server.to(`user:${userId}`).emit('kyc-status', { status });
  }
}
