import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import { Currency } from '@prisma/client';
import { SUPPORTED_CURRENCIES } from '../../../common/constants/currency.constants';

export class WalletSwapDto {
  @IsEnum(Currency)
  @IsIn(SUPPORTED_CURRENCIES)
  fromCurrency!: Currency;

  @IsEnum(Currency)
  @IsIn(SUPPORTED_CURRENCIES)
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

