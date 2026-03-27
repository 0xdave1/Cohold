import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { AuthService } from '../auth/auth.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { VerifyOtpDto } from '../auth/dto/verify-otp.dto';

@ApiTags('users')
@ApiBearerAuth('user-jwt')
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
  ) {}

  @Get('me')
  async getMe(@CurrentUser() user: { id: string }) {
    return this.usersService.getMe(user.id);
  }

  @Patch('me')
  async updateMe(@CurrentUser() user: { id: string }, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateMe(user.id, dto);
  }

  @Post('me/complete-onboarding')
  async completeOnboarding(@CurrentUser() user: { id: string }) {
    return this.usersService.completeOnboarding(user.id);
  }

  @Post('me/delete')
  async deleteAccount(@CurrentUser() user: { id: string }, @Body() dto: DeleteAccountDto) {
    await this.authService.verifyOtp(
      { email: dto.email, otp: dto.otp } as VerifyOtpDto,
      'delete_account',
    );
    return this.usersService.freezeAccount(user.id);
  }

  @Get('me/referrals')
  async getReferrals(@CurrentUser() user: { id: string }) {
    return this.usersService.getReferrals(user.id);
  }

  @Get('me/linked-banks')
  async getLinkedBanks(@CurrentUser() user: { id: string }) {
    return this.usersService.getLinkedBanks(user.id);
  }

  @Post('me/linked-banks')
  async addLinkedBank(@CurrentUser() user: { id: string }, @Body() body: { currency: string; accountNumber: string; bankName: string; accountName: string }) {
    return this.usersService.addLinkedBank(user.id, body);
  }

  @Delete('me/linked-banks/:id')
  async removeLinkedBank(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.usersService.removeLinkedBank(user.id, id);
  }
}

