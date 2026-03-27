import { Module } from '@nestjs/common';
import { UserGateway } from './user.gateway';
import { AdminGateway } from './admin.gateway';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [JwtModule.register({})],
  providers: [UserGateway, AdminGateway],
})
export class GatewayModule {}

