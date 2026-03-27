import { IsEmail } from 'class-validator';

export class OtpRequestDto {
  @IsEmail()
  email!: string;

  /**
   * Purpose of OTP: 'signup' | 'login' | 'transaction' | 'delete_account'
   */
  purpose?: 'signup' | 'login' | 'transaction' | 'delete_account';
}
