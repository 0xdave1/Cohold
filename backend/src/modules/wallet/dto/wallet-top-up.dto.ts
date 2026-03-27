import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Currency } from '@prisma/client';

export class WalletTopUpDto {
  @IsEnum(Currency)
  currency!: Currency;

  /**
   * Amount as a string for high-precision handling.
   */
  @IsString()
  amount!: string;

  /**
   * Optional client-generated idempotency key.
   */
  @IsString()
  @IsOptional()
  clientReference?: string;

  /**
   * Optional property or context for top-up (e.g., simulation or manual credit).
   */
  @IsString()
  @IsOptional()
  reason?: string;
}

