import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { WithdrawalService } from './withdrawal.service';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import { ListWithdrawalsQueryDto } from './dto/list-withdrawals.query.dto';
import { WithdrawalThrottleGuard } from './guards/withdrawal-throttle.guard';

@ApiTags('withdrawals')
@ApiBearerAuth('user-jwt')
@UseGuards(JwtAuthGuard)
@Controller('withdrawals')
export class WithdrawalController {
  constructor(private readonly withdrawalService: WithdrawalService) {}

  @Post()
  @UseGuards(WithdrawalThrottleGuard)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  async create(@CurrentUser() user: { id: string }, @Body() dto: CreateWithdrawalDto) {
    return this.withdrawalService.createWithdrawal(user.id, dto);
  }

  @Get()
  async list(@CurrentUser() user: { id: string }, @Query() query: ListWithdrawalsQueryDto) {
    return this.withdrawalService.listWithdrawals(user.id, query);
  }

  @Get(':id')
  async getOne(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.withdrawalService.getWithdrawalById(user.id, id);
  }
}
