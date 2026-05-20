import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
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

  @Post('initialize')
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @ApiOperation({ summary: 'Initialize Paystack wallet funding checkout' })
  @ApiBody({
    type: InitializePaymentDto,
    examples: {
      walletFunding: {
        summary: 'Valid request payload',
        value: { amount: 5000 },
      },
    },
  })
  @ApiOkResponse({
    description: 'Paystack checkout initialized successfully',
    schema: {
      example: {
        checkoutUrl: 'https://checkout.paystack.com/abc123',
        authorizationUrl: 'https://checkout.paystack.com/abc123',
        reference: 'PSK-WALLET-user-id|uuid',
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async initializePayment(@Body() dto: InitializePaymentDto, @Req() req: { user: { id: string; email: string } }) {
    return this.paymentService.initializeWalletFunding({
      amount: dto.amount,
      userId: req.user.id,
      email: req.user.email,
    });
  }

  @Get('verify/:reference')
  @ApiOperation({ summary: 'Verify Paystack wallet funding and credit wallet if successful' })
  async verify(@CurrentUser() user: { id: string }, @Param('reference') reference: string) {
    return this.paymentService.verifyWalletFunding(user.id, reference);
  }
}
