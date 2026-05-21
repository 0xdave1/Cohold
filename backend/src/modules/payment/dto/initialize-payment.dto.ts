import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { NAIRA_AMOUNT_STRING_PATTERN } from '../../../common/money/naira-amount.util';

export class InitializePaymentDto {
  @IsString()
  @IsNotEmpty()
  @Matches(NAIRA_AMOUNT_STRING_PATTERN, {
    message:
      'amountNaira must be a positive Naira amount with at most 2 decimal places (e.g. "1500", "1500.5", "1500.50")',
  })
  amountNaira!: string;
}
