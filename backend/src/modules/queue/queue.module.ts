import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { QueueService } from './queue.service';
import { EmailModule } from '../email/email.module';

@Global()
@Module({
  imports: [ConfigModule, EmailModule],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
