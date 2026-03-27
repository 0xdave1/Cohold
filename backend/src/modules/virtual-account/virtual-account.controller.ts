import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { VirtualAccountService } from './virtual-account.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ConfigService } from '@nestjs/config';

@ApiTags('virtual-accounts')
@Controller('virtual-accounts')
export class VirtualAccountController {
  constructor(
    private readonly virtualAccountService: VirtualAccountService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('user-jwt')
  async getMyAccounts(@CurrentUser() user: { id: string }) {
    return this.virtualAccountService.getVirtualAccountsForUser(user.id);
  }

  /**
   * Dev-only: Manually create virtual account for the current user.
   * Only works when NODE_ENV is development.
   */
  @Post('dev/create')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('user-jwt')
  async devCreateAccount(@CurrentUser() user: { id: string }) {
    const env = this.configService.get<string>('app.env') ?? process.env.NODE_ENV ?? 'development';
    if (env !== 'development') {
      throw new Error('This route is only available in development');
    }
    return this.virtualAccountService.createVirtualAccountForUser(user.id);
  }
}
