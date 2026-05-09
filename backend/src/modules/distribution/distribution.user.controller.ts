import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DistributionService } from './distribution.service';

@ApiTags('distributions')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard)
@Controller('distributions')
export class DistributionUserController {
  constructor(private readonly distributionService: DistributionService) {}

  @Get('me/history')
  async myHistory(
    @CurrentUser() user: { id: string },
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.distributionService.listUserDistributionHistory(
      user.id,
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }
}
