import { Global, Module } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheService } from './cache.service';
import { redisStore } from 'cache-manager-redis-yet';

@Global()
@Module({
  imports: [
    ConfigModule,
    NestCacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const url = config.get<string>('config.redis.url');

        // Safe caching only: if Redis is not configured, degrade to in-memory cache.
        if (!url) {
          return {
            ttl: 30, // short default TTL
          };
        }

        const store = await redisStore({
          url,
        });

        return {
          store,
          ttl: 30,
        };
      },
    }),
  ],
  providers: [CacheService],
  exports: [CacheService, NestCacheModule],
})
export class CacheModule {}

