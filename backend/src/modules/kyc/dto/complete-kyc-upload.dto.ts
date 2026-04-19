import { IsIn, IsString, MaxLength } from 'class-validator';

export class CompleteKycUploadDto {
  @IsIn(['ID_FRONT', 'ID_BACK', 'SELFIE'])
  docType!: 'ID_FRONT' | 'ID_BACK' | 'SELFIE';

  @IsString()
  @MaxLength(512)
  key!: string;
}

