import { Module } from '@nestjs/common';
import { FlutterwavePayoutProvider } from './flutterwave-payout.provider';
import { PAYOUT_PROVIDER } from './payout-provider.interface';

@Module({
  providers: [
    FlutterwavePayoutProvider,
    {
      provide: PAYOUT_PROVIDER,
      useExisting: FlutterwavePayoutProvider,
    },
  ],
  exports: [PAYOUT_PROVIDER, FlutterwavePayoutProvider],
})
export class PayoutModule {}
