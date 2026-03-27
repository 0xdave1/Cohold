import { IsString, Length } from 'class-validator';

export class SubmitNinDto {
  @IsString()
  @Length(11, 11)
  nin!: string;
}

