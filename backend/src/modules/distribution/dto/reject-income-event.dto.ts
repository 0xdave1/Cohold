import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectIncomeEventDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
