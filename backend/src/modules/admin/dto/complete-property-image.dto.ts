import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CompletePropertyImageDto {
  @IsString()
  @MaxLength(512)
  key!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  altText?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}

