import { Module } from '@nestjs/common';
import { PaystackPayoutProvider } from './paystack-payout.provider';
import { PAYOUT_PROVIDER } from './payout-provider.interface';
import { PaystackProvider } from '../payment/providers/paystack.provider';

@Module({
  providers: [
    PaystackProvider,
    PaystackPayoutProvider,
    {
      provide: PAYOUT_PROVIDER,
      useExisting: PaystackPayoutProvider,
    },
  ],
  exports: [PAYOUT_PROVIDER, PaystackPayoutProvider, PaystackProvider],
})
export class PayoutModule {}
