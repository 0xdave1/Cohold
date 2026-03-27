import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class SellFractionalInvestmentDto {
  @IsUUID()
  propertyId!: string;

  /** Whole or fractional shares to sell (string decimal, matches Investment.shares precision). */
  @IsString()
  @IsNotEmpty()
  sharesToSell!: string;

  @IsOptional()
  @IsString()
  clientReference?: string;
}
