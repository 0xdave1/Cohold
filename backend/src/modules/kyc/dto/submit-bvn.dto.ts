import { IsString, Length } from 'class-validator';

export class SubmitBvnDto {
  @IsString()
  @Length(11, 11)
  bvn!: string;
}

