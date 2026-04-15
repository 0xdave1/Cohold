import { IsEnum, IsString } from 'class-validator';
import { Currency } from '@prisma/client';

export class P2PPreviewDto {
  @IsString()
  recipientUserId!: string;

  @IsEnum(Currency)
  currency!: Currency;

  /** Decimal-safe amount as string */
  @IsString()
  amount!: string;
}

