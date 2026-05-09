import { IsEnum, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { SupportCategory, SupportPriority } from '@prisma/client';

export class CreateSupportConversationDto {
  @IsEnum(SupportCategory)
  category!: SupportCategory;

  @IsOptional()
  @IsEnum(SupportPriority)
  priority?: SupportPriority;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  subject?: string;

  /** Structured triage payload (transactionRef, amount, currency, propertyId, explanation, etc.) */
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

