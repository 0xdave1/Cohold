import { Body, Controller, ForbiddenException, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { WalletSwapDto } from './dto/wallet-swap.dto';
import { WalletDevCreditDto } from './dto/wallet-dev-credit.dto';

/**
 * Security (Issue 1): Authenticated users must never be able to mint wallet balance.
 * There is no POST /wallets/top-up and no user-supplied “credit” DTO. NGN credits only
 * flow from verified Flutterwave settlement (PaymentService) or this dev-only escape hatch.
 */
@ApiTags('wallets')
@ApiBearerAuth('user-jwt')
@UseGuards(JwtAuthGuard)
@Controller('wallets')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('balances')
  async getBalances(@CurrentUser() user: { id: string }) {
    return this.walletService.getBalances(user.id);
  }

  @Get('virtual-accounts')
  async getVirtualAccounts(@CurrentUser() user: { id: string }) {
    return this.walletService.getVirtualAccounts(user.id);
  }

  @Post('swap')
  async swap(@CurrentUser() user: { id: string }, @Body() dto: WalletSwapDto) {
    return this.walletService.swap(user.id, dto);
  }

  /**
   * Local/test-only: synthetic ledger credit for QA. Must never be reachable in production
   * (controller + service guard). Not used by webhooks, payments, or investments.
   */
  @Post('dev-credit')
  async devCredit(@CurrentUser() user: { id: string }, @Body() dto: WalletDevCreditDto) {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Not available in production');
    }
    return this.walletService.devCredit(user.id, dto);
  }

  @Get('transactions')
  async transactions(
    @CurrentUser() user: { id: string },
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('direction') direction?: string,
    @Query('currency') currency?: string,
    @Query('q') q?: string,
  ) {
    return this.walletService.getTransactions(user.id, {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      type,
      status,
      direction,
      currency,
      q,
    });
  }
}

