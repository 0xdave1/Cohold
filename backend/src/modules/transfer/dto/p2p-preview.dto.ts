import { IsEnum, IsIn, IsString } from 'class-validator';
import { Currency } from '@prisma/client';
import { SUPPORTED_CURRENCIES } from '../../../common/constants/currency.constants';

export class P2PPreviewDto {
  @IsString()
  recipientUserId!: string;

  @IsEnum(Currency)
  @IsIn(SUPPORTED_CURRENCIES)
  currency!: Currency;

  /** Decimal-safe amount as string */
  @IsString()
  amount!: string;
}

