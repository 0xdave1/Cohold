import { IsOptional, IsString } from 'class-validator';

export class P2PTransferDto {
  /**
   * Recipient handle in the format @username.
   */
  @IsString()
  recipientHandle!: string;

  /**
   * Amount as a string (Decimal-safe).
   */
  @IsString()
  amount!: string;

  @IsOptional()
  @IsString()
  clientReference?: string;
}

