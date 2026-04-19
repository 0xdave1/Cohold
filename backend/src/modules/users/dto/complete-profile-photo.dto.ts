import { IsString, MaxLength } from 'class-validator';

export class CompleteProfilePhotoDto {
  @IsString()
  @MaxLength(512)
  key!: string;
}

