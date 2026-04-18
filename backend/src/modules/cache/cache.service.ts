import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

/**
 * CacheService
 * - For safe, read-heavy caching only.
 * - Do not cache money truth (balances, ledger, ownership).
 * - Backed by Redis when REDIS_URL is set; otherwise falls back to in-memory cache.
 */
@Injectable()
export class CacheService {
  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  async get<T = unknown>(key: string): Promise<T | null> {
    const v = await this.cache.get<T>(key);
    return (v ?? null) as T | null;
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds && ttlSeconds > 0) {
      await this.cache.set(key, value, ttlSeconds);
      return;
    }
    await this.cache.set(key, value);
  }

  async del(key: string): Promise<void> {
    await this.cache.del(key);
  }
}
