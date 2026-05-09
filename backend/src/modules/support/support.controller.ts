import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
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

  private sanitizeSupportMetadata(input: unknown): Record<string, unknown> | undefined {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return undefined;
    const source = input as Record<string, unknown>;
    const allowedKeys = new Set([
      'transactionRef',
      'amount',
      'currency',
      'propertyId',
      'investmentId',
      'withdrawalId',
      'walletReference',
      'description',
      'category',
    ]);
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(source)) {
      if (!allowedKeys.has(k)) continue;
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' || v == null) {
        out[k] = v;
      }
    }
    return Object.keys(out).length > 0 ? out : undefined;
  }

  private parseBoundedInt(value: string, fallback: number, min: number, max: number): number {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, parsed));
  }

  @Post('conversations')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async createConversation(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateSupportConversationDto,
  ) {
    const meta = this.sanitizeSupportMetadata(dto.metadata);
    return this.supportService.createConversation({
      userId: user.id,
      category: dto.category,
      subject: dto.subject ?? null,
      priority: dto.priority,
      metadata:
        meta === undefined
          ? undefined
          : (JSON.parse(JSON.stringify(meta)) as Prisma.JsonValue),
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
      this.parseBoundedInt(page, 1, 1, 1000),
      this.parseBoundedInt(limit, 50, 1, 100),
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
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async sendMessage(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: SendSupportMessageDto,
  ) {
    const metadataPayload: Record<string, unknown> = {
      ...(this.sanitizeSupportMetadata(dto.metadata) ?? {}),
      messageId: dto.messageId,
      attachments: dto.attachments?.map((a) => ({
        storageKey: a.storageKey,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
        fileName: a.fileName,
      })),
    };
    const metadata = JSON.parse(JSON.stringify(metadataPayload)) as Prisma.JsonValue;
    return this.supportService.sendUserMessage(user.id, id, dto.content, metadata);
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

