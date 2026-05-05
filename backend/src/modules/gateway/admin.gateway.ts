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
  namespace: '/ws/admin',
  cors: wsCorsOptions(),
})
export class AdminGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly wsAuth: WsAuthTokenVerifier) {}

  async handleConnection(client: Socket): Promise<void> {
    const token = getAccessTokenFromHandshake(client);
    if (!token) {
      client.disconnect(true);
      return;
    }
    const adminId = await this.wsAuth.verifyAdminAccessSocket(token);
    if (!adminId) {
      client.disconnect(true);
      return;
    }
    client.join(`admin:${adminId}`);
    client.join('admin:all');
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket, @MessageBody() _data: any) {
    client.emit('pong', { ts: Date.now() });
  }
}
