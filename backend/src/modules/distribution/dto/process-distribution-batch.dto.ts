import { IsOptional, IsString } from 'class-validator';

export class ProcessDistributionBatchDto {
  @IsOptional()
  @IsString()
  reference?: string;
}
