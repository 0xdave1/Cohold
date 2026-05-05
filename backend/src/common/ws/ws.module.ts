import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../../prisma/prisma.module';
import { WsAuthTokenVerifier } from './ws-auth-token.verifier';

@Module({
  imports: [PrismaModule, JwtModule.register({})],
  providers: [WsAuthTokenVerifier],
  exports: [WsAuthTokenVerifier],
})
export class WsModule {}
