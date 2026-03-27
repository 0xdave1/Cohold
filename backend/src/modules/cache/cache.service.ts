// Redis/Queue temporarily disabled – can be re-enabled later

import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  /** In-memory fallback when Redis is disabled */
  private memory = new Map<string, string>();

  constructor() {}

  onModuleInit(): void {}

  async onModuleDestroy(): Promise<void> {
    this.memory.clear();
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const value = this.memory.get(key);
    if (!value) return null;
    return JSON.parse(value) as T;
  }

  async set(
    key: string,
    value: unknown,
    ttlSeconds?: number,
  ): Promise<void> {
    const payload = JSON.stringify(value);
    this.memory.set(key, payload);
    if (ttlSeconds && ttlSeconds > 0) {
      setTimeout(() => this.memory.delete(key), ttlSeconds * 1000);
    }
  }

  async del(key: string): Promise<void> {
    this.memory.delete(key);
  }
}
