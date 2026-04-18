import { IsEmail, IsIn, IsOptional, IsString, Length } from 'class-validator';

export class VerifyOtpDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(6, 6)
  otp!: string;

  @IsOptional()
  @IsIn(['signup', 'login', 'reset', 'transaction', 'delete_account'])
  purpose?: 'signup' | 'login' | 'reset' | 'transaction' | 'delete_account';
}

