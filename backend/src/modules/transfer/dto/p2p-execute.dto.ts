import { IsEnum, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { Currency } from '@prisma/client';
import { SUPPORTED_CURRENCIES } from '../../../common/constants/currency.constants';

export class P2PExecuteDto {
  @IsString()
  recipientUserId!: string;

  @IsEnum(Currency)
  @IsIn(SUPPORTED_CURRENCIES)
  currency!: Currency;

  /** Decimal-safe amount as string */
  @IsString()
  amount!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  note?: string;

  /** Client-provided idempotency key (uuid recommended) */
  @IsString()
  idempotencyKey!: string;
}

