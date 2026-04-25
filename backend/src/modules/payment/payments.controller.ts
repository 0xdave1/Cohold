import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaymentService } from './payment.service';
import { InitializePaymentDto } from './dto/initialize-payment.dto';

@ApiTags('payments')
@ApiBearerAuth('user-jwt')
@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('flutterwave/initialize')
  async initializeFlutterwave(
    @CurrentUser() user: { id: string },
    @Body() dto: InitializePaymentDto,
  ) {
    return this.paymentService.initializeWalletFunding(user.id, dto);
  }

  @Get('verify/:reference')
  async verify(@CurrentUser() user: { id: string }, @Param('reference') reference: string) {
    return this.paymentService.verifyWalletFunding(user.id, reference);
  }
}
