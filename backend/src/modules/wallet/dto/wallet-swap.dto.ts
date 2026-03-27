import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Currency } from '@prisma/client';

export class WalletSwapDto {
  @IsEnum(Currency)
  fromCurrency!: Currency;

  @IsEnum(Currency)
  toCurrency!: Currency;

  /**
   * Amount as a string for precise Decimal math.
   */
  @IsString()
  amount!: string;

  /**
   * Client-provided reference for idempotency.
   */
  @IsString()
  @IsOptional()
  clientReference?: string;
}

