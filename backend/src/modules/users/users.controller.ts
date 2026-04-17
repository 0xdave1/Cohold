import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { AuthService } from '../auth/auth.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { VerifyOtpDto } from '../auth/dto/verify-otp.dto';
import { SetUsernameDto } from './dto/set-username.dto';
import { AddLinkedBankDto } from './dto/add-linked-bank.dto';

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

  @Get('username-availability')
  @ApiOperation({ summary: 'Check if a username is available' })
  @ApiQuery({ name: 'username', required: true, type: String })
  async usernameAvailability(@Query('username') username: string) {
    return this.usersService.checkUsernameAvailability(username);
  }

  @Patch('me/username')
  @ApiOperation({ summary: 'Set username for current user' })
  async setUsername(@CurrentUser() user: { id: string }, @Body() dto: SetUsernameDto) {
    return this.usersService.setUsername(user.id, dto.username);
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
  async addLinkedBank(@CurrentUser() user: { id: string }, @Body() body: AddLinkedBankDto) {
    return this.usersService.addLinkedBank(user.id, body);
  }

  @Delete('me/linked-banks/:id')
  async removeLinkedBank(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.usersService.removeLinkedBank(user.id, id);
  }
}

