import { IsEmail } from 'class-validator';

export class OtpRequestDto {
  @IsEmail()
  email!: string;

  /**
   * Purpose of OTP: 'signup' | 'login' | 'reset' | 'transaction' | 'delete_account'
   */
  purpose?: 'signup' | 'login' | 'reset' | 'transaction' | 'delete_account';
}
