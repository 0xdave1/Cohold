import { IsIn, IsString, MaxLength } from 'class-validator';

export class CompletePropertyDocumentDto {
  @IsIn(['TITLE', 'SURVEY', 'DEED', 'OTHER'])
  type!: 'TITLE' | 'SURVEY' | 'DEED' | 'OTHER';

  @IsString()
  @MaxLength(512)
  key!: string;
}

