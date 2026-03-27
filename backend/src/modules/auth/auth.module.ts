import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../../common/guards/admin-role.guard';
import { EmailModule } from '../email/email.module';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('config.jwt.accessSecret'),
        signOptions: {
          expiresIn: config.get<string>('config.jwt.accessExpiresIn') ?? '15m',
        },
      }),
    }),
    EmailModule,
    CacheModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, AdminRoleGuard],
  exports: [AuthService, JwtModule, JwtAuthGuard, AdminRoleGuard],
})
export class AuthModule {}