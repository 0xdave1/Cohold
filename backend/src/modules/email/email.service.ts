import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sgMail from '@sendgrid/mail';

const CONFIG_NAMESPACE = 'config';

/**
 * Email service using SendGrid.
 * Reads config from ConfigService under namespace 'config' (registerAs('config', …)):
 * - config.email.apiKey  (EMAIL_API_KEY)
 * - config.email.from    (EMAIL_FROM)
 *
 * When API key is missing, logs a warning at startup and no-ops on send (app does not crash).
 * Production-ready for Cohold backend.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly fromEmail: string;
  private readonly fromName: string;
  /** True when SendGrid API key is set and emails can be sent. */
  private readonly isConfigured: boolean;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.getConfig<string>('email.apiKey');
    const from = this.getConfig<string>('email.from') ?? 'Cohold <no-reply@cohold.com>';

    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
      this.logger.warn(
        'EMAIL_API_KEY not configured (config.email.apiKey). Email sending disabled. Set EMAIL_API_KEY in .env to enable.',
      );
      this.isConfigured = false;
    } else {
      sgMail.setApiKey(apiKey.trim());
      this.isConfigured = true;
    }

    const match = from.match(/^(.+?)\s*<(.+?)>$/);
    if (match) {
      this.fromName = match[1].trim();
      this.fromEmail = match[2].trim();
    } else {
      this.fromEmail = from;
      this.fromName = 'Cohold';
    }
  }

  /**
   * Read from namespaced config (registerAs('config', …)).
   */
  private getConfig<T = string>(path: string): T | undefined {
    return this.configService.get<T>(`${CONFIG_NAMESPACE}.${path}`);
  }

  /**
   * Whether the service can send emails (API key present).
   */
  get configured(): boolean {
    return this.isConfigured;
  }

  /**
   * Send OTP email for email verification or high-value transactions.
   */
  async sendOtpEmail(
    to: string,
    otp: string,
    purpose: 'verification' | 'transaction' = 'verification',
  ): Promise<void> {
    const subject =
      purpose === 'verification'
        ? 'Verify your Cohold account'
        : 'Confirm your transaction';

    const html = this.buildOtpHtml(otp, purpose);
    await this.sendEmail(to, subject, html);
  }

  /**
   * Send welcome email after successful signup.
   */
  async sendWelcomeEmail(to: string, firstName?: string): Promise<void> {
    const html = this.buildWelcomeHtml(firstName);
    await this.sendEmail(to, 'Welcome to Cohold', html);
  }

  /**
   * Send transaction confirmation email.
   */
  async sendTransactionConfirmation(
    to: string,
    type: 'top-up' | 'investment' | 'distribution',
    amount: string,
    currency: string,
    details?: Record<string, unknown>,
  ): Promise<void> {
    const subject = `Transaction Confirmed - ${type}`;
    const html = this.buildTransactionHtml(type, amount, currency, details);
    await this.sendEmail(to, subject, html);
  }

  /**
   * Send KYC status update email.
   */
  async sendKycStatusEmail(
    to: string,
    status: 'approved' | 'rejected',
    reason?: string,
  ): Promise<void> {
    const subject =
      status === 'approved'
        ? 'KYC Verification Approved'
        : 'KYC Verification Requires Attention';
    const html = this.buildKycStatusHtml(status, reason);
    await this.sendEmail(to, subject, html);
  }

  /**
   * Internal: send one email via SendGrid. No-ops and logs if not configured.
   */
  private async sendEmail(to: string, subject: string, html: string): Promise<void> {
    if (!this.isConfigured) {
      this.logger.debug(
        `Email sending disabled. Would send to ${to}: ${subject}`,
      );
      return;
    }

    try {
      await sgMail.send({
        to,
        from: {
          email: this.fromEmail,
          name: this.fromName,
        },
        subject,
        html,
      });
      this.logger.log(`Email sent to ${to}: ${subject}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to send email to ${to}: ${message}`, stack);
      throw error;
    }
  }

  private buildOtpHtml(otp: string, purpose: 'verification' | 'transaction'): string {
    const title =
      purpose === 'verification' ? 'Verify Your Account' : 'Confirm Transaction';
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; border-radius: 8px; padding: 30px; text-align: center;">
            <h1 style="color: #1e40af; margin-bottom: 20px;">${title}</h1>
            <p style="font-size: 16px; margin-bottom: 30px;">Your verification code is:</p>
            <div style="background-color: #ffffff; border: 2px dashed #1e40af; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h2 style="color: #1e40af; font-size: 32px; letter-spacing: 8px; margin: 0;">${otp}</h2>
            </div>
            <p style="font-size: 14px; color: #666; margin-top: 30px;">
              This code expires in 10 minutes. Never share this code with anyone.
            </p>
            <p style="font-size: 12px; color: #999; margin-top: 40px;">
              If you didn't request this code, please ignore this email.
            </p>
          </div>
        </body>
      </html>
    `;
  }

  private buildWelcomeHtml(firstName?: string): string {
    const raw = this.getConfig<string>('app.corsOrigin');
    const appUrl =
      raw && raw !== '*' ? raw.split(',')[0].trim() : 'https://cohold.co';
    const dashboardUrl = appUrl.replace(/\/$/, '') + '/dashboard';
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; border-radius: 8px; padding: 30px;">
            <h1 style="color: #1e40af; margin-bottom: 20px;">Welcome to Cohold${firstName ? `, ${firstName}` : ''}!</h1>
            <p style="font-size: 16px; margin-bottom: 20px;">
              Thank you for joining Cohold. You're now ready to start investing in fractional real estate.
            </p>
            <p style="font-size: 16px; margin-bottom: 30px;">
              Complete your KYC verification to unlock all features and start investing.
            </p>
            <a href="${dashboardUrl}"
               style="display: inline-block; background-color: #1e40af; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
              Go to Dashboard
            </a>
          </div>
        </body>
      </html>
    `;
  }

  private buildTransactionHtml(
    type: 'top-up' | 'investment' | 'distribution',
    amount: string,
    currency: string,
    details?: Record<string, unknown>,
  ): string {
    const typeLabels: Record<string, string> = {
      'top-up': 'Wallet Top-Up',
      investment: 'Property Investment',
      distribution: 'Distribution Received',
    };
    const reference =
      details && typeof details.reference === 'string'
        ? details.reference
        : 'N/A';
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; border-radius: 8px; padding: 30px;">
            <h1 style="color: #1e40af; margin-bottom: 20px;">Transaction Confirmed</h1>
            <p style="font-size: 16px; margin-bottom: 20px;">
              Your ${typeLabels[type]} has been processed successfully.
            </p>
            <div style="background-color: #ffffff; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <p style="font-size: 24px; font-weight: 600; color: #1e40af; margin: 0;">
                ${currency} ${amount}
              </p>
            </div>
            <p style="font-size: 14px; color: #666;">Reference: ${reference}</p>
            <p style="font-size: 14px; color: #666; margin-top: 30px;">
              View your transaction history in your dashboard.
            </p>
          </div>
        </body>
      </html>
    `;
  }

  private buildKycStatusHtml(
    status: 'approved' | 'rejected',
    reason?: string,
  ): string {
    const color = status === 'approved' ? '#10b981' : '#ef4444';
    const title = status === 'approved' ? 'Approved' : 'Rejected';
    const body =
      status === 'approved'
        ? '<p style="font-size: 16px;">Your KYC verification has been approved. You can now access all features.</p>'
        : `
          <p style="font-size: 16px;">Your KYC verification requires attention.</p>
          ${reason ? `<p style="font-size: 14px; color: #666; margin-top: 10px;">Reason: ${reason}</p>` : ''}
          <p style="font-size: 14px; margin-top: 20px;">Please update your information and resubmit.</p>
        `;
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; border-radius: 8px; padding: 30px;">
            <h1 style="color: ${color}; margin-bottom: 20px;">KYC Verification ${title}</h1>
            ${body}
          </div>
        </body>
      </html>
    `;
  }
}
