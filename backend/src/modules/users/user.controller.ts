import { Body, Controller, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PersonalDetailsDto } from './dto/personal-details.dto';
import { ResidentialDetailsDto } from './dto/residential-details.dto';

/**
 * Onboarding endpoints under /user (singular) as required by frontend.
 * PUT /user/personal-details, PUT /user/residential-details.
 */
@ApiTags('users')
@ApiBearerAuth('user-jwt')
@UseGuards(JwtAuthGuard)
@Controller('user')
export class UserController {
  constructor(private readonly usersService: UsersService) {}

  @Put('personal-details')
  async updatePersonalDetails(
    @CurrentUser() user: { id: string },
    @Body() dto: PersonalDetailsDto,
  ) {
    return this.usersService.updatePersonalDetails(user.id, dto);
  }

  @Put('residential-details')
  async updateResidentialDetails(
    @CurrentUser() user: { id: string },
    @Body() dto: ResidentialDetailsDto,
  ) {
    return this.usersService.updateResidentialDetails(user.id, dto);
  }
}
