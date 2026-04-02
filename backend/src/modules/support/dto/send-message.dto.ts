import { IsArray, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class SupportAttachmentInputDto {
  @IsString()
  storageKey!: string;

  @IsString()
  @MaxLength(120)
  mimeType!: string;

  sizeBytes!: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  fileName?: string;
}

export class SendSupportMessageDto {
  /** Optional client-generated message id (UUID) used to attach uploads before sending. */
  @IsOptional()
  @IsString()
  messageId?: string;

  @IsString()
  @MaxLength(5000)
  content!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SupportAttachmentInputDto)
  attachments?: SupportAttachmentInputDto[];

  @IsOptional()
  metadata?: Record<string, unknown>;
}

