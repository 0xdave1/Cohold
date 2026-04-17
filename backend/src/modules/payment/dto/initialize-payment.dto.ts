import { IsEnum, IsIn, IsNumberString } from 'class-validator';
import { Currency } from '@prisma/client';
import { SUPPORTED_CURRENCIES } from '../../../common/constants/currency.constants';

export class InitializePaymentDto {
  @IsNumberString()
  amount!: string;

  @IsEnum(Currency)
  @IsIn(SUPPORTED_CURRENCIES)
  currency!: Currency;
}
