import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { VirtualAccountService } from './virtual-account.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('virtual-accounts')
@Controller('virtual-accounts')
export class VirtualAccountController {
  constructor(private readonly virtualAccountService: VirtualAccountService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('user-jwt')
  async getMyVirtualAccount(@CurrentUser() user: { id: string }) {
    return this.virtualAccountService.getVirtualAccountForUser(user.id);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('user-jwt')
  async getMyAccountsLegacy(@CurrentUser() user: { id: string }) {
    return this.virtualAccountService.getVirtualAccountsForUser(user.id);
  }

  @Post('me/retry')
  @Throttle({ default: { limit: 5, ttl: 10 * 60_000 } })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('user-jwt')
  async retryMyVirtualAccount(@CurrentUser() user: { id: string }) {
    return this.virtualAccountService.retryVirtualAccountForUser(user.id);
  }
}
