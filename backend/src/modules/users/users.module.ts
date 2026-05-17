import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { UserController } from './user.controller';
import { PayoutModule } from '../payout/payout.module';
import { KycModule } from '../kyc/kyc.module';

@Module({
  imports: [AuthModule, PayoutModule, KycModule],
  controllers: [UsersController, UserController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}


