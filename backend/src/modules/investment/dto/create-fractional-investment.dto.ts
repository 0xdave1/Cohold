import { IsOptional, IsString } from 'class-validator';

export class CreateFractionalInvestmentDto {
  @IsString()
  propertyId!: string;

  @IsString()
  shares!: string;

  /** Idempotency key; when using Paystack, use the Paystack reference. */
  @IsOptional()
  @IsString()
  clientReference?: string;

  /** Paystack payment reference. When provided, verifies payment via Paystack instead of deducting from wallet. */
  @IsOptional()
  @IsString()
  paystackReference?: string;
}
