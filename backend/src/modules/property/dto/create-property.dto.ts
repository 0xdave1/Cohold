import { IsEnum, IsNumberString, IsOptional, IsString } from 'class-validator';
import { Currency } from '@prisma/client';

export class CreatePropertyDto {
  @IsString()
  title!: string;

  @IsString()
  description!: string;

  @IsString()
  location!: string;

  @IsEnum(Currency)
  currency!: Currency;

  /**
   * Total value as string (NUMERIC(24,8)).
   */
  @IsNumberString()
  totalValue!: string;

  /**
   * Total number of shares for this property.
   */
  @IsNumberString()
  sharesTotal!: string;

  /**
   * Minimum investment ticket size.
   */
  @IsNumberString()
  minInvestment!: string;

  /**
   * Price per share. If omitted, auto-calculated as totalValue / sharesTotal.
   */
  @IsOptional()
  @IsNumberString()
  sharePrice?: string;

  @IsOptional()
  @IsString()
  type?: string;
}

