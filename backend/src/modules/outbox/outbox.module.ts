import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { GatewayModule } from '../gateway/gateway.module';
import { OutboxService } from './outbox.service';
import { OutboxWorker } from './outbox.worker';
import { JobRegistryService } from './job-registry.service';
import { OpsController } from './ops.controller';

@Module({
  imports: [EmailModule, GatewayModule],
  providers: [OutboxService, OutboxWorker, JobRegistryService],
  controllers: [OpsController],
  exports: [OutboxService, JobRegistryService],
})
export class OutboxModule {}
