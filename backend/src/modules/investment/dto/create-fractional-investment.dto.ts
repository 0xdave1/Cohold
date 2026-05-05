import { IsOptional, IsString } from 'class-validator';

export class CreateFractionalInvestmentDto {
  @IsString()
  propertyId!: string;

  @IsString()
  shares!: string;

  /** Idempotency key for the investment ledger (e.g. provider checkout reference when paying by card). */
  @IsOptional()
  @IsString()
  clientReference?: string;

  /**
   * Optional provider checkout reference (e.g. Flutterwave `tx_ref`). Name is legacy;
   * wallet-settled flows use Flutterwave hosted pay, not Paystack.
   */
  @IsOptional()
  @IsString()
  paystackReference?: string;
}
