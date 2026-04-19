import { IsInt, IsString, Max, MaxLength, Min } from 'class-validator';

export class PresignProfilePhotoDto {
  @IsString()
  @MaxLength(200)
  fileName!: string;

  @IsString()
  @MaxLength(120)
  contentType!: string;

  @IsInt()
  @Min(1)
  @Max(10_000_000)
  fileSize!: number;
}

