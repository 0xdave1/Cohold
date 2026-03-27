import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PropertyService } from './property.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../../common/guards/admin-role.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('admin-properties')
@ApiBearerAuth('admin-jwt')
@UseGuards(JwtAuthGuard, AdminRoleGuard, RolesGuard)
@Controller('admin/properties')
export class PropertyController {
  constructor(private readonly propertyService: PropertyService) {}

  @Post()
  @Roles(AdminRole.DATA_UPLOADER, AdminRole.APPROVER, AdminRole.COMPLIANCE_ADMIN, AdminRole.SUPER_ADMIN)
  async create(
    @CurrentUser() admin: { id: string },
    @Body() dto: CreatePropertyDto,
  ) {
    return this.propertyService.createProperty(admin.id, dto);
  }

  @Patch(':id/submit-review')
  @Roles(AdminRole.DATA_UPLOADER, AdminRole.COMPLIANCE_ADMIN, AdminRole.SUPER_ADMIN)
  async submitReview(
    @CurrentUser() admin: { id: string },
    @Param('id') id: string,
  ) {
    return this.propertyService.submitForReview(admin.id, id);
  }

  @Patch(':id/approve')
  @Roles(AdminRole.APPROVER, AdminRole.COMPLIANCE_ADMIN, AdminRole.SUPER_ADMIN)
  async approve(
    @CurrentUser() admin: { id: string },
    @Param('id') id: string,
  ) {
    return this.propertyService.approve(admin.id, id);
  }

  @Patch(':id/publish')
  @Roles(AdminRole.APPROVER, AdminRole.COMPLIANCE_ADMIN, AdminRole.SUPER_ADMIN)
  async publish(
    @CurrentUser() admin: { id: string },
    @Param('id') id: string,
  ) {
    return this.propertyService.publish(admin.id, id);
  }

  @Get(':id/details')
  @Roles(AdminRole.DATA_UPLOADER, AdminRole.APPROVER, AdminRole.COMPLIANCE_ADMIN, AdminRole.SUPER_ADMIN)
  async details(@Param('id') id: string) {
    return this.propertyService.getDetails(id);
  }
}

