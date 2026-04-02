import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../../common/guards/admin-role.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SupportService } from './support.service';
import { SupportAdminGuard } from './guards/support-admin.guard';
import { SendSupportMessageDto } from './dto/send-message.dto';
import { AssignSupportConversationDto } from './dto/assign-conversation.dto';
import { SetSupportPresenceDto } from './dto/presence.dto';
import { ListAdminSupportConversationsDto } from './dto/list-admin-conversations.dto';
import { StorageService } from '../storage/storage.service';
import { PresignSupportAttachmentDto } from './dto/presign-attachment.dto';

@ApiTags('admin-support')
@ApiBearerAuth('admin-jwt')
@UseGuards(JwtAuthGuard, AdminRoleGuard, RolesGuard, SupportAdminGuard)
@Controller('admin/support')
export class SupportAdminController {
  constructor(
    private readonly supportService: SupportService,
    private readonly storageService: StorageService,
  ) {}

  @Get('conversations')
  async listConversations(
    @CurrentUser() admin: { id: string },
    @Query() q: ListAdminSupportConversationsDto,
  ) {
    return this.supportService.listAdminConversations(admin.id, {
      status: q.status,
      category: q.category,
      assigned: (q.assigned as any) ?? 'all',
      search: q.search,
      page: q.page ?? 1,
      limit: q.limit ?? 20,
    });
  }

  @Get('conversations/:id')
  async conversation(@Param('id') id: string) {
    return this.supportService.getAdminConversation(id);
  }

  @Get('conversations/:id/messages')
  async messages(
    @Param('id') id: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    return this.supportService.listConversationMessagesForAdmin(id, parseInt(page, 10), parseInt(limit, 10));
  }

  @Post('conversations/:id/messages')
  async sendMessage(
    @CurrentUser() admin: { id: string },
    @Param('id') id: string,
    @Body() dto: SendSupportMessageDto,
  ) {
    const metadata = {
      ...(dto.metadata ?? {}),
      messageId: dto.messageId,
      attachments: dto.attachments,
    };
    return this.supportService.sendAdminMessage(admin.id, id, dto.content, metadata as any);
  }

  @Post('conversations/:id/internal-notes')
  async internalNote(
    @CurrentUser() admin: { id: string },
    @Param('id') id: string,
    @Body() dto: SendSupportMessageDto,
  ) {
    const metadata = {
      ...(dto.metadata ?? {}),
      messageId: dto.messageId,
      attachments: dto.attachments,
    };
    return this.supportService.addInternalNote(admin.id, id, dto.content, metadata as any);
  }

  @Post('conversations/:id/assign')
  async assign(
    @CurrentUser() admin: { id: string },
    @Param('id') id: string,
    @Body() dto: AssignSupportConversationDto,
  ) {
    const assignedAdminId = dto.adminId ?? admin.id;
    return this.supportService.assignConversation(admin.id, id, assignedAdminId);
  }

  @Post('conversations/:id/resolve')
  async resolve(@CurrentUser() admin: { id: string }, @Param('id') id: string) {
    return this.supportService.resolveConversation(admin.id, id);
  }

  @Post('presence')
  async setPresence(@CurrentUser() admin: { id: string }, @Body() dto: SetSupportPresenceDto) {
    return this.supportService.setPresence(admin.id, dto.isOnline);
  }

  @Get('presence/online')
  async online() {
    return this.supportService.listOnlineSupportAdmins();
  }

  @Post('attachments/presign')
  async presignAttachment(@Body() dto: PresignSupportAttachmentDto) {
    const key = this.storageService.generateSupportAttachmentKey(dto.conversationId, dto.messageId, dto.fileName ?? null);
    const url = await this.storageService.getPresignedPutUrl(key, dto.mimeType);
    return { storageKey: key, uploadUrl: url };
  }
}

