import { IsEnum, IsNumberString } from 'class-validator';
import { Currency } from '@prisma/client';

export class InitializePaymentDto {
  @IsNumberString()
  amount!: string;

  @IsEnum(Currency)
  currency!: Currency;
}
