import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
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
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Initialize Flutterwave wallet funding checkout' })
  @ApiBody({
    type: InitializePaymentDto,
    examples: {
      walletFunding: {
        summary: 'Valid request payload',
        value: {
          amount: 5000,
        },
      },
    },
  })
  @ApiOkResponse({
    description: 'Flutterwave checkout initialized successfully',
    schema: {
      example: {
        checkoutUrl: 'https://checkout.flutterwave.com/v3/hosted/pay/abc123',
        reference: 'flw_wallet_123e4567-e89b-12d3-a456-426614174000',
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Validation failed (e.g., amount is missing, non-numeric, or below minimum)',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async initializeFlutterwavePayment(
    @Body() dto: InitializePaymentDto,
    @Req() req: any,
  ) {
    const user = req.user as { id: string; email: string };
    return this.paymentService.initializeFlutterwavePayment({
      amount: dto.amount,
      userId: user.id,
      email: user.email,
    });
  }

  @Get('verify/:reference')
  async verify(@CurrentUser() user: { id: string }, @Param('reference') reference: string) {
    return this.paymentService.verifyWalletFunding(user.id, reference);
  }
}
