import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class PresignPropertyImageDto {
  @IsString()
  @MaxLength(200)
  fileName!: string;

  @IsString()
  @MaxLength(120)
  contentType!: string;

  @IsInt()
  @Min(1)
  @Max(20_000_000)
  fileSize!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}

