import { IsEmail, IsString, Length } from 'class-validator';

export class DeleteAccountDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(6, 6)
  otp!: string;
}
