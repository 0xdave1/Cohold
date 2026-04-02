import { IsOptional, IsString, MaxLength } from 'class-validator';

export class PresignSupportAttachmentDto {
  @IsString()
  conversationId!: string;

  @IsString()
  messageId!: string;

  @IsString()
  @MaxLength(120)
  mimeType!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  fileName?: string;
}

