import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { OutboxModule } from '../outbox/outbox.module';

@Module({
  imports: [PrismaModule, RedisModule, OutboxModule],
  controllers: [HealthController],
})
export class HealthModule {}

