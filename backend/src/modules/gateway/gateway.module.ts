import { Module } from '@nestjs/common';
import { UserGateway } from './user.gateway';
import { AdminGateway } from './admin.gateway';
import { WsModule } from '../../common/ws/ws.module';

@Module({
  imports: [WsModule],
  providers: [UserGateway, AdminGateway],
})
export class GatewayModule {}

