import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CompleteKycUploadDto {
  @IsIn(['ID_FRONT', 'ID_BACK', 'SELFIE'])
  docType!: 'ID_FRONT' | 'ID_BACK' | 'SELFIE';

  @IsString()
  @MaxLength(512)
  key!: string;

  @IsString()
  @MaxLength(120)
  contentType!: string;

  @IsInt()
  @Min(1)
  @Max(40_000_000)
  sizeBytes!: number;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  etag?: string;
}
