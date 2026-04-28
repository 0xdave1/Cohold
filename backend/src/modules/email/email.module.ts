import { Global, Module } from '@nestjs/common';
import { EMAIL_PROVIDER_TOKEN } from './constants/email.constants';
import { EmailService } from './email.service';
import { ResendProvider } from './providers/resend.provider';

@Global()
@Module({
  providers: [
    ResendProvider,
    {
      provide: EMAIL_PROVIDER_TOKEN,
      useExisting: ResendProvider,
    },
    EmailService,
  ],
  exports: [EmailService],
})
export class EmailModule {}
