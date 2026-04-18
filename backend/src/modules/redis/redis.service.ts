import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RedisClientType } from 'redis';
import { createClient } from 'redis';

export class RedisUnavailableError extends Error {
  constructor(message = 'Redis is not configured or unavailable') {
    super(message);
    this.name = 'RedisUnavailableError';
  }
}

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: RedisClientType | null = null;
  private enabled = false;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const url =
      this.configService.get<string>('config.redis.url') ??
      this.configService.get<string>('REDIS_URL'); // fallback (some modules may read env directly in tests)

    if (!url) {
      this.enabled = false;
      this.logger.warn('REDIS_URL not set. Redis features will be unavailable.');
      return;
    }

    this.enabled = true;
    this.client = createClient({ url });

    this.client.on('connect', () => this.logger.log('Redis connecting…'));
    this.client.on('ready', () => this.logger.log('Redis ready.'));
    this.client.on('reconnecting', () => this.logger.warn('Redis reconnecting…'));
    this.client.on('error', (err) => this.logger.error(`Redis error: ${err?.message ?? err}`));

    // Fire-and-forget connect; consumers will see RedisUnavailableError if not ready.
    void this.client.connect().catch((err) => {
      this.logger.error(`Redis connect failed: ${err?.message ?? err}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
      } catch (e) {
        this.logger.warn(`Redis quit failed: ${(e as Error)?.message ?? e}`);
      } finally {
        this.client = null;
      }
    }
  }

  /**
   * Raw Redis client accessor (avoid using directly unless needed).
   * Prefer helper methods to keep key semantics consistent.
   */
  raw(): RedisClientType {
    const c = this.assertClient();
    return c;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  private assertClient(): RedisClientType {
    if (!this.enabled || !this.client) throw new RedisUnavailableError();
    return this.client;
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const c = this.assertClient();
    const v = await c.get(key);
    if (v == null) return null;
    return JSON.parse(v) as T;
  }

  async set(
    key: string,
    value: Json,
    opts?: { ttlSeconds?: number; nx?: boolean },
  ): Promise<void> {
    const c = this.assertClient();
    const payload = JSON.stringify(value);
    const ttl = opts?.ttlSeconds;
    const nx = opts?.nx;

    if (ttl && ttl > 0 && nx) {
      await c.set(key, payload, { EX: ttl, NX: true });
      return;
    }
    if (ttl && ttl > 0) {
      await c.set(key, payload, { EX: ttl });
      return;
    }
    if (nx) {
      await c.set(key, payload, { NX: true });
      return;
    }
    await c.set(key, payload);
  }

  async del(key: string): Promise<number> {
    const c = this.assertClient();
    return c.del(key);
  }

  async increment(key: string, by = 1, ttlSeconds?: number): Promise<number> {
    const c = this.assertClient();
    // Use a small transaction to preserve TTL on first creation.
    const multi = c.multi();
    multi.incrBy(key, by);
    if (ttlSeconds && ttlSeconds > 0) {
      // Ensure TTL exists; `EXPIRE` is idempotent.
      multi.expire(key, ttlSeconds);
    }
    const res = await multi.exec();
    const first = res?.[0] as unknown;
    // redis v4 returns number directly for INCRBY in MULTI responses.
    return typeof first === 'number' ? first : Number(first);
  }

  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    const c = this.assertClient();
    return c.expire(key, ttlSeconds);
  }
}

