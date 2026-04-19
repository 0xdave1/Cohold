import { IsIn, IsInt, IsString, Max, MaxLength, Min } from 'class-validator';

export class PresignKycUploadDto {
  @IsIn(['ID_FRONT', 'ID_BACK', 'SELFIE'])
  docType!: 'ID_FRONT' | 'ID_BACK' | 'SELFIE';

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
}

