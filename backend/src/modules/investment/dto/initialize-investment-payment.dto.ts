import { IsString } from 'class-validator';

export class InitializeInvestmentPaymentDto {
  @IsString()
  propertyId!: string;

  @IsString()
  shares!: string;
}
