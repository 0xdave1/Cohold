import { IsArray, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class SupportAttachmentInputDto {
  @IsString()
  storageKey!: string;

  @IsString()
  @MaxLength(120)
  mimeType!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10 * 1024 * 1024)
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
  @IsObject()
  metadata?: Record<string, unknown>;
}

