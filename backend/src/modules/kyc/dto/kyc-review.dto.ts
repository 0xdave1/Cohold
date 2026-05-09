import { IsString, MaxLength, MinLength } from 'class-validator';

export class KycReviewDto {
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  failureReason?: string;
}

