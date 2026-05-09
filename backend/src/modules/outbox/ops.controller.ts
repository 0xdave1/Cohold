import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminRole, OutboxEventStatus } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminJwtGuard } from '../../common/guards/admin-jwt.guard';
import { AdminRoleGuard } from '../../common/guards/admin-role.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JobRegistryService } from './job-registry.service';
import { OutboxService } from './outbox.service';

@ApiTags('admin-ops')
@ApiBearerAuth('admin-jwt')
@UseGuards(AdminJwtGuard, AdminRoleGuard, RolesGuard)
@Roles(AdminRole.SUPER_ADMIN, AdminRole.COMPLIANCE_ADMIN)
@Controller('admin/ops')
export class OpsController {
  constructor(
    private readonly outbox: OutboxService,
    private readonly jobs: JobRegistryService,
  ) {}

  @Get('outbox')
  async listOutbox(
    @Query('status') status?: OutboxEventStatus,
    @Query('type') type?: string,
    @Query('limit') limit = '100',
  ) {
    const rows = await this.outbox.listOutbox({
      status,
      type,
      take: Math.max(1, Math.min(100, parseInt(limit, 10) || 100)),
    });
    return rows.map((r) => this.outbox.sanitizeOutboxEventForAdmin(r));
  }

  @Get('outbox/:id')
  async outboxDetail(@Param('id') id: string) {
    const row = await this.outbox.getOutboxById(id);
    if (!row) return null;
    return this.outbox.sanitizeOutboxEventForAdmin(row);
  }

  @Post('outbox/:id/retry')
  async retryOutbox(@Param('id') id: string) {
    const result = await this.outbox.retryDeadLetter(id);
    return { retried: result.count > 0 };
  }

  @Get('dead-letter')
  async deadLetter(@Query('limit') limit = '100') {
    const rows = await this.outbox.listDeadLetter(Math.max(1, Math.min(100, parseInt(limit, 10) || 100)));
    return rows.map((r) => this.outbox.sanitizeOutboxEventForAdmin(r));
  }

  @Get('jobs')
  async jobsRegistry() {
    return this.jobs.listJobs();
  }
}
