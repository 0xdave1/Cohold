import { IsBoolean, IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';

/** NGN-only linked bank for payouts (currency kept for future expansion). */
export class AddLinkedBankDto {
  @IsIn(['NGN'])
  currency!: 'NGN';

  @IsString()
  @Matches(/^\d{10,16}$/, { message: 'accountNumber must be 10–16 digits' })
  accountNumber!: string;

  @IsString()
  @Length(3, 12)
  bankCode!: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
