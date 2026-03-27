import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PropertyService } from './property.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('properties')
@ApiBearerAuth('user-jwt')
@UseGuards(JwtAuthGuard)
@Controller('properties')
export class ListingsController {
  constructor(private readonly propertyService: PropertyService) {}

  @Get()
  async list(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.propertyService.listPublished(
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.propertyService.getPublishedById(id);
  }

  @Get(':id/details')
  async getDetails(@Param('id') id: string) {
    return this.propertyService.getDetails(id);
  }
}
