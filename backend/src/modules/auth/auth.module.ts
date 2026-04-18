import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../../common/guards/admin-role.guard';
import { EmailModule } from '../email/email.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthOtpService } from './auth-otp.service';
import { AuthAttemptsService } from './auth-attempts.service';

@Global()
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
    NotificationsModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthOtpService, AuthAttemptsService, JwtAuthGuard, AdminRoleGuard],
  exports: [AuthService, JwtModule, JwtAuthGuard, AdminRoleGuard],
})
export class AuthModule {}