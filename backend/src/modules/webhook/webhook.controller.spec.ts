import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { PaymentService } from '../payment/payment.service';
import { WithdrawalService } from '../withdrawal/withdrawal.service';
import { PAYOUT_PROVIDER } from '../payout/payout-provider.interface';

describe('WebhookController', () => {
  it('rejects invalid webhook signature', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [WebhookController],
      providers: [
        { provide: PaymentService, useValue: { handleFlutterwaveWebhook: jest.fn() } },
        { provide: WithdrawalService, useValue: { handlePayoutWebhook: jest.fn() } },
        {
          provide: PAYOUT_PROVIDER,
          useValue: {
            verifyWebhookSignature: jest.fn().mockReturnValue(false),
            parseTransferWebhook: jest.fn().mockReturnValue(null),
          },
        },
      ],
    }).compile();

    const controller = moduleRef.get(WebhookController);
    await expect(
      controller.handleFlutterwaveWebhook('bad', { 'verif-hash': 'bad' }, { event: 'charge.completed' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
