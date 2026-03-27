import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TransferService } from './transfer.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { P2PTransferDto } from './dto/p2p-transfer.dto';

@ApiTags('transfers')
@ApiBearerAuth('user-jwt')
@UseGuards(JwtAuthGuard)
@Controller('transfers')
export class TransferController {
  constructor(private readonly transferService: TransferService) {}

  @Post('p2p')
  async p2p(
    @CurrentUser() user: { id: string },
    @Body() dto: P2PTransferDto,
  ) {
    return this.transferService.p2pTransfer(user.id, dto);
  }
}

