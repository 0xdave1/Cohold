import { IsIn, IsInt, IsString, Max, MaxLength, Min } from 'class-validator';

export class PresignPropertyDocumentDto {
  @IsIn(['TITLE', 'SURVEY', 'DEED', 'OTHER'])
  type!: 'TITLE' | 'SURVEY' | 'DEED' | 'OTHER';

  @IsString()
  @MaxLength(200)
  fileName!: string;

  @IsString()
  @MaxLength(120)
  contentType!: string;

  @IsInt()
  @Min(1)
  @Max(30_000_000)
  fileSize!: number;
}

