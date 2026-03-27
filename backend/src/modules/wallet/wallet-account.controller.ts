import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { WalletService } from './wallet.service';

@ApiTags('wallet')
@ApiBearerAuth('user-jwt')
@UseGuards(JwtAuthGuard)
@Controller('wallet')
export class WalletAccountController {
  constructor(private readonly walletService: WalletService) {}

  @Get('account-details')
  async accountDetails(@CurrentUser() user: { id: string }) {
    return this.walletService.getAccountDetails(user.id);
  }
}

