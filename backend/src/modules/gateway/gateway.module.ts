import { Module } from '@nestjs/common';
import { UserGateway } from './user.gateway';
import { AdminGateway } from './admin.gateway';
import { WebSocketDeliveryService } from './websocket-delivery.service';
import { WsModule } from '../../common/ws/ws.module';

@Module({
  imports: [WsModule],
  providers: [UserGateway, AdminGateway, WebSocketDeliveryService],
  /**
   * UserGateway / AdminGateway: direct injection where a gateway is required.
   * WebSocketDeliveryService: preferred for emit-only use (e.g. OutboxService) to avoid DI edge cases.
   */
  exports: [UserGateway, AdminGateway, WebSocketDeliveryService],
})
export class GatewayModule {}

