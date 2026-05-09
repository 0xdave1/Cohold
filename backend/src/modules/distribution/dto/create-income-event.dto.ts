import { Currency, PropertyIncomeEventType } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateIncomeEventDto {
  @IsString()
  propertyId!: string;

  @IsString()
  amount!: string;

  @IsEnum(Currency)
  currency!: Currency;

  @IsEnum(PropertyIncomeEventType)
  type!: PropertyIncomeEventType;

  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @IsOptional()
  @IsDateString()
  periodEnd?: string;

  @IsDateString()
  receivedAt!: string;

  @IsOptional()
  @IsString()
  sourceReference?: string;
}
