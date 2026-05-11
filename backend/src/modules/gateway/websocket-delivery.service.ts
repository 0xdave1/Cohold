import { Injectable } from '@nestjs/common';
import { UserGateway } from './user.gateway';

/**
 * Thin adapter for domain code (e.g. OutboxService) to emit to user rooms without depending on
 * {@link UserGateway} / socket.io types. Keeps a single {@link UserGateway} instance in {@link GatewayModule}.
 */
@Injectable()
export class WebSocketDeliveryService {
  constructor(private readonly userGateway: UserGateway) {}

  emitToUser(userId: string, event: string, data: unknown): void {
    this.userGateway.server?.to(`user:${userId}`).emit(event, data);
  }
}
