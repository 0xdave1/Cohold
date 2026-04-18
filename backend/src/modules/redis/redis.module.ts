import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisService } from './redis.service';

/**
 * RedisModule
 * - Provides a singleton official `redis` client for ephemeral state.
 * - PostgreSQL remains the source of truth for all money / ledger / ownership state.
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}

