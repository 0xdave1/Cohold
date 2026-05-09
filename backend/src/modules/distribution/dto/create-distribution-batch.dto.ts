import { IsOptional, IsString } from 'class-validator';

export class CreateDistributionBatchDto {
  @IsString()
  incomeEventId!: string;

  @IsOptional()
  @IsString()
  expenses?: string;

  @IsOptional()
  @IsString()
  platformFee?: string;

  @IsOptional()
  @IsString()
  reference?: string;
}
