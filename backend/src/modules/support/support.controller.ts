import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateSupportConversationDto } from './dto/create-conversation.dto';
import { SendSupportMessageDto } from './dto/send-message.dto';
import { SupportService } from './support.service';
import { StorageService } from '../storage/storage.service';
import { PresignSupportAttachmentDto } from './dto/presign-attachment.dto';

@ApiTags('support')
@ApiBearerAuth('user-jwt')
@UseGuards(JwtAuthGuard)
@Controller('support')
export class SupportController {
  constructor(
    private readonly supportService: SupportService,
    private readonly storageService: StorageService,
  ) {}

  @Post('conversations')
  async createConversation(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateSupportConversationDto,
  ) {
    return this.supportService.createConversation({
      userId: user.id,
      category: dto.category,
      subject: dto.subject ?? null,
      priority: dto.priority,
      metadata: (dto.metadata ?? undefined) as any,
    });
  }

  @Get('conversations')
  async listConversations(@CurrentUser() user: { id: string }) {
    return this.supportService.listUserConversations(user.id);
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser() user: { id: string }) {
    return this.supportService.getUserUnreadCount(user.id);
  }

  @Get('conversations/:id')
  async conversation(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.supportService.getUserConversation(user.id, id);
  }

  @Get('conversations/:id/messages')
  async messages(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    return this.supportService.listConversationMessagesForUser(
      user.id,
      id,
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }

  @Patch('conversations/:id/read')
  async markConversationRead(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.supportService.markConversationAsRead(user.id, id);
  }

  @Patch('read-all')
  async markAllRead(@CurrentUser() user: { id: string }) {
    return this.supportService.markAllAsRead(user.id);
  }

  @Post('conversations/:id/messages')
  async sendMessage(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: SendSupportMessageDto,
  ) {
    const metadata = {
      ...(dto.metadata ?? {}),
      messageId: dto.messageId,
      attachments: dto.attachments,
    };
    return this.supportService.sendUserMessage(user.id, id, dto.content, metadata as any);
  }

  @Post('attachments/presign')
  async presignAttachment(@CurrentUser() user: { id: string }, @Body() dto: PresignSupportAttachmentDto) {
    // User can only presign for their own conversation
    await this.supportService.getUserConversation(user.id, dto.conversationId);
    const key = this.storageService.generateSupportAttachmentKey(dto.conversationId, dto.messageId, dto.fileName ?? null);
    const url = await this.storageService.getPresignedPutUrl(key, dto.mimeType);
    return { storageKey: key, uploadUrl: url };
  }
}

