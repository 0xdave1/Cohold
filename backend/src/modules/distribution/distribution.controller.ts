import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DistributionService } from './distribution.service';
import { CreateDistributionDto } from './dto/create-distribution.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../../common/guards/admin-role.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('admin-distributions')
@ApiBearerAuth('admin-jwt')
@UseGuards(JwtAuthGuard, AdminRoleGuard, RolesGuard)
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
