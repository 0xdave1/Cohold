import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { WalletService } from './wallet.service';

@ApiTags('transactions')
@ApiBearerAuth('user-jwt')
@UseGuards(JwtAuthGuard)
@Controller('transactions')
export class TransactionReceiptController {
  constructor(private readonly walletService: WalletService) {}

  /** Receipt for a grouped business operation (BUY / SELL / ROI / swap / top-up). */
  @Get(':reference')
  async getByReference(
    @CurrentUser() user: { id: string },
    @Param('reference') reference: string,
  ) {
    return this.walletService.getTransactionReceipt(user.id, reference);
  }
}
