import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DistributionService } from './distribution.service';
import { CreateDistributionDto } from './dto/create-distribution.dto';
import { AdminJwtGuard } from '../../common/guards/admin-jwt.guard';
import { AdminRoleGuard } from '../../common/guards/admin-role.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminRole, DistributionBatchStatus, PropertyIncomeEventStatus } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateIncomeEventDto } from './dto/create-income-event.dto';
import { CreateDistributionBatchDto } from './dto/create-distribution-batch.dto';
import { ProcessDistributionBatchDto } from './dto/process-distribution-batch.dto';
import { RejectIncomeEventDto } from './dto/reject-income-event.dto';

@ApiTags('admin-distributions')
@ApiBearerAuth('admin-jwt')
@UseGuards(AdminJwtGuard, AdminRoleGuard, RolesGuard)
@Controller('admin/distributions')
export class DistributionController {
  constructor(private readonly distributionService: DistributionService) {}

  @Roles(AdminRole.APPROVER, AdminRole.COMPLIANCE_ADMIN, AdminRole.SUPER_ADMIN)
  @Post('monthly-yield/:propertyId')
  async distributeMonthlyYield(
    @CurrentUser() admin: { id: string },
    @Param('propertyId') propertyId: string,
  ) {
    return this.distributionService.distributeMonthlyRentalYield(propertyId, admin.id);
  }

  @Roles(AdminRole.APPROVER, AdminRole.COMPLIANCE_ADMIN, AdminRole.SUPER_ADMIN)
  @Post('create')
  async create(
    @CurrentUser() admin: { id: string },
    @Body() dto: CreateDistributionDto,
  ) {
    return this.distributionService.createDistribution(admin.id, dto);
  }

  @Roles(AdminRole.DATA_UPLOADER, AdminRole.APPROVER, AdminRole.COMPLIANCE_ADMIN, AdminRole.SUPER_ADMIN)
  @Post('income-events')
  async createIncomeEvent(@CurrentUser() admin: { id: string }, @Body() dto: CreateIncomeEventDto) {
    return this.distributionService.createIncomeEvent(admin.id, dto);
  }

  @Roles(AdminRole.APPROVER, AdminRole.COMPLIANCE_ADMIN, AdminRole.SUPER_ADMIN)
  @Post('income-events/:id/approve')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async approveIncomeEvent(@CurrentUser() admin: { id: string }, @Param('id') id: string) {
    return this.distributionService.approveIncomeEvent(admin.id, id);
  }

  @Roles(AdminRole.APPROVER, AdminRole.COMPLIANCE_ADMIN, AdminRole.SUPER_ADMIN)
  @Post('income-events/:id/reject')
  async rejectIncomeEvent(
    @CurrentUser() admin: { id: string },
    @Param('id') id: string,
    @Body() body: RejectIncomeEventDto,
  ) {
    return this.distributionService.rejectIncomeEvent(admin.id, id, body.reason);
  }

  @Roles(AdminRole.DATA_UPLOADER, AdminRole.APPROVER, AdminRole.COMPLIANCE_ADMIN, AdminRole.SUPER_ADMIN)
  @Get('income-events')
  async listIncomeEvents(
    @Query('propertyId') propertyId?: string,
    @Query('status') status?: PropertyIncomeEventStatus,
  ) {
    return this.distributionService.listIncomeEvents(propertyId, status);
  }

  @Roles(AdminRole.DATA_UPLOADER, AdminRole.APPROVER, AdminRole.COMPLIANCE_ADMIN, AdminRole.SUPER_ADMIN)
  @Post('batches')
  async createBatch(@CurrentUser() admin: { id: string }, @Body() dto: CreateDistributionBatchDto) {
    return this.distributionService.createDistributionBatch(admin.id, dto);
  }

  @Roles(AdminRole.DATA_UPLOADER, AdminRole.APPROVER, AdminRole.COMPLIANCE_ADMIN, AdminRole.SUPER_ADMIN)
  @Get('batches')
  async listBatches(@Query('propertyId') propertyId?: string, @Query('status') status?: DistributionBatchStatus) {
    return this.distributionService.listDistributionBatches(propertyId, status);
  }

  @Roles(AdminRole.DATA_UPLOADER, AdminRole.APPROVER, AdminRole.COMPLIANCE_ADMIN, AdminRole.SUPER_ADMIN)
  @Get('batches/:id')
  async batchDetail(@Param('id') id: string) {
    return this.distributionService.getDistributionBatch(id);
  }

  @Roles(AdminRole.DATA_UPLOADER, AdminRole.APPROVER, AdminRole.COMPLIANCE_ADMIN, AdminRole.SUPER_ADMIN)
  @Get('batches/:id/preview')
  async previewBatch(@Param('id') id: string) {
    return this.distributionService.previewDistributionBatch(id);
  }

  @Roles(AdminRole.APPROVER, AdminRole.COMPLIANCE_ADMIN, AdminRole.SUPER_ADMIN)
  @Post('batches/:id/approve')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async approveBatch(@CurrentUser() admin: { id: string }, @Param('id') id: string) {
    return this.distributionService.approveDistributionBatch(admin.id, id);
  }

  @Roles(AdminRole.APPROVER, AdminRole.COMPLIANCE_ADMIN, AdminRole.SUPER_ADMIN)
  @Post('batches/:id/process')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async processBatch(
    @CurrentUser() admin: { id: string },
    @Param('id') id: string,
    @Body() dto: ProcessDistributionBatchDto,
  ) {
    return this.distributionService.processDistributionBatch(id, dto, admin.id);
  }

  @Roles(AdminRole.APPROVER, AdminRole.COMPLIANCE_ADMIN, AdminRole.SUPER_ADMIN)
  @Get('batches/:id/failed-items')
  async failedItems(@Param('id') id: string) {
    return this.distributionService.listFailedDistributionItems(id);
  }

  @Roles(AdminRole.APPROVER, AdminRole.COMPLIANCE_ADMIN, AdminRole.SUPER_ADMIN)
  @Post('batches/:id/retry-failed')
  async retryFailedItems(@CurrentUser() admin: { id: string }, @Param('id') id: string) {
    return this.distributionService.retryFailedDistributionItems(id, admin.id);
  }

  @Roles(AdminRole.DATA_UPLOADER, AdminRole.APPROVER, AdminRole.COMPLIANCE_ADMIN, AdminRole.SUPER_ADMIN)
  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.distributionService.getDistribution(id);
  }

  @Roles(AdminRole.DATA_UPLOADER, AdminRole.APPROVER, AdminRole.COMPLIANCE_ADMIN, AdminRole.SUPER_ADMIN)
  @Get()
  async list(
    @Query('propertyId') propertyId?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.distributionService.listDistributions(
      propertyId,
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }
}
