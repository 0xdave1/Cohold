import { IsOptional, IsString } from 'class-validator';

export class KycReviewDto {
  @IsOptional()
  @IsString()
  failureReason?: string;
}

