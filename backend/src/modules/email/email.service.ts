import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DEFAULT_FROM, EMAIL_PROVIDER_TOKEN } from './constants/email.constants';
import { ResendProvider } from './providers/resend.provider';
import { kycTemplate, otpTemplate, passwordResetSuccessTemplate, transactionTemplate, welcomeTemplate } from './templates/email.templates';
import { KycEmailStatus, TransactionEmailKind } from './types/email.types';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly fromEmail: string;
  private readonly fromName: string;

  constructor(
    private readonly configService: ConfigService,
    @Inject(EMAIL_PROVIDER_TOKEN) private readonly provider: ResendProvider,
  ) {
    const from = this.configService.get<string>('config.email.from') ?? DEFAULT_FROM;
    const match = from.match(/^(.+?)\s*<(.+?)>$/);
    if (match) {
      this.fromName = match[1].trim();
      this.fromEmail = match[2].trim();
    } else {
      this.fromName = 'Cohold';
      this.fromEmail = from.trim();
    }
  }

  get configured(): boolean {
    return this.provider.configured;
  }

  async sendOtpEmail(to: string, otp: string, purpose: 'verification' | 'transaction' = 'verification'): Promise<void> {
    const subject = purpose === 'verification' ? 'Verify your Cohold account' : 'Confirm your transaction';
    await this.safeSend(to, subject, otpTemplate(otp, purpose));
  }

  async sendWelcomeEmail(to: string, firstName?: string): Promise<void> {
    await this.safeSend(to, 'Welcome to Cohold', welcomeTemplate(firstName));
  }

  async sendPasswordResetSuccessEmail(to: string): Promise<void> {
    await this.safeSend(to, 'Your Cohold password was changed', passwordResetSuccessTemplate());
  }

  async sendKycStatusEmail(to: string, status: KycEmailStatus, reason?: string): Promise<void> {
    const subjectByStatus: Record<KycEmailStatus, string> = {
      submitted: 'KYC Submitted',
      approved: 'KYC Verification Approved',
      rejected: 'KYC Verification Requires Attention',
    };
    await this.safeSend(to, subjectByStatus[status], kycTemplate(status, reason));
  }

  async sendTransactionEmail(
    to: string,
    kind: TransactionEmailKind,
    amount: string,
    currency: string,
    details?: Record<string, unknown>,
  ): Promise<void> {
    const titleByKind: Record<TransactionEmailKind, string> = {
      deposit: 'Wallet Deposit Confirmation',
      withdrawal_request: 'Withdrawal Request Received',
      withdrawal_success: 'Withdrawal Completed',
      withdrawal_failure: 'Withdrawal Failed',
      transfer_incoming: 'Money Received',
      transfer_outgoing: 'Transfer Sent',
      investment_success: 'Investment Confirmed',
      investment_sale: 'Investment Sale Completed',
      roi_payout: 'Payout Credited',
    };
    await this.safeSend(to, titleByKind[kind], transactionTemplate(kind, amount, currency, details));
  }

  private async safeSend(to: string, subject: string, html: string): Promise<void> {
    try {
      const result = await this.provider.send({
        to,
        subject,
        html,
        fromEmail: this.fromEmail,
        fromName: this.fromName,
      });
      this.logger.log(`email delivered provider=${result.provider} to=${to} subject="${subject}"`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`email delivery failed to=${to} subject="${subject}" reason=${msg}`);
      throw error;
    }
  }
}
