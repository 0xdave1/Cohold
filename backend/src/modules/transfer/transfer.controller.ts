import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { TransferService } from './transfer.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { P2PTransferDto } from './dto/p2p-transfer.dto';
import { P2PPreviewDto } from './dto/p2p-preview.dto';
import { P2PExecuteDto } from './dto/p2p-execute.dto';

@ApiTags('transfers')
@ApiBearerAuth('user-jwt')
@UseGuards(JwtAuthGuard)
@Controller('transfers')
export class TransferController {
  constructor(private readonly transferService: TransferService) {}

  @Get('p2p/search')
  @ApiOperation({ summary: 'Search recipients by username' })
  @ApiQuery({ name: 'query', required: true, type: String })
  async search(@CurrentUser() user: { id: string }, @Query('query') query: string) {
    return this.transferService.searchRecipients(user.id, query);
  }

  @Post('p2p/preview')
  @ApiOperation({ summary: 'Preview P2P transfer' })
  async preview(@CurrentUser() user: { id: string }, @Body() dto: P2PPreviewDto) {
    return this.transferService.preview(user.id, dto);
  }

  @Post('p2p/execute')
  @ApiOperation({ summary: 'Execute P2P transfer (idempotent)' })
  async execute(@CurrentUser() user: { id: string }, @Body() dto: P2PExecuteDto) {
    return this.transferService.execute(user.id, dto);
  }

  @Get('p2p/history')
  @ApiOperation({ summary: 'List P2P transfer history' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async history(
    @CurrentUser() user: { id: string },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.transferService.history(user.id, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('p2p/:id')
  @ApiOperation({ summary: 'Get a P2P transfer receipt' })
  async get(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.transferService.getById(user.id, id);
  }

  @Post('p2p')
  async p2p(
    @CurrentUser() user: { id: string },
    @Body() dto: P2PTransferDto,
  ) {
    return this.transferService.p2pTransfer(user.id, dto);
  }
}

