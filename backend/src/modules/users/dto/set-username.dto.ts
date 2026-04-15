import { IsString } from 'class-validator';

export class SetUsernameDto {
  @IsString()
  username!: string;
}

