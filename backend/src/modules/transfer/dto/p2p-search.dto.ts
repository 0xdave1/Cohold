import { IsOptional, IsString, MinLength } from 'class-validator';

export class P2PSearchDto {
  @IsString()
  @MinLength(2)
  query!: string;

  @IsOptional()
  @IsString()
  currency?: string;
}

