import { IsIn, IsString, Length, Matches } from 'class-validator';

export class CreateWithdrawalDto {
  @IsString()
  @Length(1, 100)
  idempotencyKey!: string;

  @IsString()
  linkedBankAccountId!: string;

  /** Decimal string, max 4 dp (matches wallet precision). */
  @IsString()
  @Matches(/^\d+(\.\d{1,4})?$/, { message: 'amount must be a positive decimal with at most 4 decimal places' })
  amount!: string;

  @IsIn(['NGN'])
  currency!: 'NGN';

  @IsString()
  @Length(6, 6)
  otp!: string;
}
