import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { ProviderSendInput, ProviderSendResult } from '../types/email.types';

@Injectable()
export class ResendProvider {
  private readonly logger = new Logger(ResendProvider.name);
  private readonly client: Resend | null;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('config.email.apiKey');
    if (!apiKey || apiKey.trim().length === 0) {
      this.client = null;
      this.logger.warn('RESEND_API_KEY missing. Email delivery disabled.');
      return;
    }
    this.client = new Resend(apiKey.trim());
  }

  get configured(): boolean {
    return this.client != null;
  }

  async send(input: ProviderSendInput): Promise<ProviderSendResult> {
    if (!this.client) {
      this.logger.debug(`Skipping email send (provider disabled) to=${input.to} subject="${input.subject}"`);
      return { provider: 'resend' };
    }

    const from =
      input.fromName && input.fromName.trim().length > 0
        ? `${input.fromName.trim()} <${input.fromEmail}>`
        : input.fromEmail;

    const response = await this.client.emails.send({
      from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
    });

    if (response.error) {
      throw new Error(response.error.message ?? 'Resend failed to send email');
    }

    this.logger.debug(
      `resend accepted email to=${input.to} subject="${input.subject}" id=${response.data?.id ?? 'n/a'}`,
    );
    return {
      provider: 'resend',
      providerMessageId: response.data?.id,
    };
  }
}
