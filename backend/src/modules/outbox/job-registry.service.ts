import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JobRegistryService {
  constructor(private readonly prisma: PrismaService) {}

  async markRunStart(name: string, nextRunAt?: Date): Promise<void> {
    await this.prisma.scheduledJobState.upsert({
      where: { name },
      update: { lastRunAt: new Date(), nextRunAt: nextRunAt ?? null },
      create: { name, lastRunAt: new Date(), nextRunAt: nextRunAt ?? null, enabled: true },
    });
  }

  async markSuccess(name: string, nextRunAt?: Date): Promise<void> {
    await this.prisma.scheduledJobState.upsert({
      where: { name },
      update: {
        lastRunAt: new Date(),
        lastSuccessAt: new Date(),
        lastError: null,
        nextRunAt: nextRunAt ?? null,
      },
      create: {
        name,
        enabled: true,
        lastRunAt: new Date(),
        lastSuccessAt: new Date(),
        nextRunAt: nextRunAt ?? null,
      },
    });
  }

  async markFailure(name: string, error: string, nextRunAt?: Date): Promise<void> {
    await this.prisma.scheduledJobState.upsert({
      where: { name },
      update: {
        lastRunAt: new Date(),
        lastFailureAt: new Date(),
        lastError: error,
        nextRunAt: nextRunAt ?? null,
      },
      create: {
        name,
        enabled: true,
        lastRunAt: new Date(),
        lastFailureAt: new Date(),
        lastError: error,
        nextRunAt: nextRunAt ?? null,
      },
    });
  }

  listJobs() {
    return this.prisma.scheduledJobState.findMany({ orderBy: { name: 'asc' } });
  }
}
