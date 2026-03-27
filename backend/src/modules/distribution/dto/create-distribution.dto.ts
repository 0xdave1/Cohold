import { IsEnum, IsString } from 'class-validator';
import { Currency } from '@prisma/client';

export class CreateDistributionDto {
  @IsString()
  propertyId!: string;

  @IsString()
  totalAmount!: string;

  @IsEnum(Currency)
  currency!: Currency;
}
