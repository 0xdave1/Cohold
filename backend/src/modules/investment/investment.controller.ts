import { Controller, Get, Param, Post, Query, Body, UseGuards, NotImplementedException } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InvestmentService } from './investment.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateFractionalInvestmentDto } from './dto/create-fractional-investment.dto';
import { SellFractionalInvestmentDto } from './dto/sell-fractional-investment.dto';
import { InitializeInvestmentPaymentDto } from './dto/initialize-investment-payment.dto';

@ApiTags('investments')
@ApiBearerAuth('user-jwt')
@UseGuards(JwtAuthGuard)
@Controller('investments')
export class InvestmentController {
  constructor(private readonly investmentService: InvestmentService) {}

  @Post('fractional/initialize-payment')
  async initializePayment(
    @CurrentUser() user: { id: string; email: string },
    @Body() dto: InitializeInvestmentPaymentDto,
  ) {
    void user;
    void dto;
    throw new NotImplementedException(
      'Direct investment checkout is disabled. Fund your wallet first, then purchase via wallet-funded investment.',
    );
  }

  @Post('fractional')
  async createFractional(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateFractionalInvestmentDto,
  ) {
    return this.investmentService.createFractional(user.id, dto);
  }

  /** Atomic sell with profit-only platform fee (see InvestmentService.sellFractional). */
  @Post('fractional/sell')
  async sellFractional(
    @CurrentUser() user: { id: string },
    @Body() dto: SellFractionalInvestmentDto,
  ) {
    return this.investmentService.sellFractional(user.id, dto);
  }

  @Get(':id')
  async getById(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.investmentService.getInvestment(id, user.id);
  }

  @Get()
  async getByUser(
    @CurrentUser() user: { id: string },
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.investmentService.getInvestmentsByUser(
      user.id,
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }
}

