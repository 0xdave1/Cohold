import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { OutboxService } from '../outbox/outbox.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly outbox: OutboxService,
  ) {}

  @Get('live')
  live() {
    return { ok: true, status: 'live' };
  }

  @Get('ready')
  async ready() {
    let dbOk = false;
    let redisOk = !this.redisService.isEnabled();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbOk = true;
    } catch {
      dbOk = false;
    }
    if (this.redisService.isEnabled()) {
      try {
        await this.redisService.raw().ping();
        redisOk = true;
      } catch {
        redisOk = false;
      }
    }
    const outbox = await this.outbox.backlogSummary();
    return {
      ok: dbOk && redisOk,
      status: dbOk && redisOk ? 'ready' : 'degraded',
      checks: {
        db: dbOk ? 'up' : 'down',
        redis: redisOk ? 'up' : 'down',
        outbox:
          outbox.deadLetter > 0 || outbox.pending > 1000
            ? 'degraded'
            : 'up',
      },
      outbox: {
        pending: outbox.pending,
        processing: outbox.processing,
        deadLetter: outbox.deadLetter,
      },
    };
  }
}

