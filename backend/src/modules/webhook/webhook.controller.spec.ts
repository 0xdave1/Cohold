import { UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { WebhookController } from './webhook.controller';
import { PaymentService } from '../payment/payment.service';
import { WithdrawalService } from '../withdrawal/withdrawal.service';
import { PAYOUT_PROVIDER } from '../payout/payout-provider.interface';
import type { Request } from 'express';

describe('WebhookController Paystack', () => {
  it('rejects invalid signature before payment processing', async () => {
    const payment = { handlePaystackWebhook: jest.fn() };
    const payoutProvider = { verifyWebhookSignature: jest.fn().mockReturnValue(false) };
    const moduleRef = await Test.createTestingModule({
      controllers: [WebhookController],
      providers: [
        { provide: PaymentService, useValue: payment },
        { provide: WithdrawalService, useValue: { handlePayoutWebhook: jest.fn() } },
        { provide: PAYOUT_PROVIDER, useValue: payoutProvider },
      ],
    }).compile();
    const controller = moduleRef.get(WebhookController);
    const req = { rawBody: Buffer.from('{}'), headers: {} } as Request & { rawBody: Buffer };
    await expect(
      controller.handlePaystackWebhook({}, req, { event: 'charge.success' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(payment.handlePaystackWebhook).not.toHaveBeenCalled();
  });

  it('routes transfer events to withdrawal service', async () => {
    const payment = { handlePaystackWebhook: jest.fn() };
    const withdrawal = { handlePayoutWebhook: jest.fn().mockResolvedValue({ received: true }) };
    const payoutProvider = { verifyWebhookSignature: jest.fn().mockReturnValue(true) };
    const moduleRef = await Test.createTestingModule({
      controllers: [WebhookController],
      providers: [
        { provide: PaymentService, useValue: payment },
        { provide: WithdrawalService, useValue: withdrawal },
        { provide: PAYOUT_PROVIDER, useValue: payoutProvider },
      ],
    }).compile();
    const controller = moduleRef.get(WebhookController);
    const req = { rawBody: Buffer.from('{}'), headers: {} } as Request & { rawBody: Buffer };
    await controller.handlePaystackWebhook({}, req, { event: 'transfer.success' });
    expect(withdrawal.handlePayoutWebhook).toHaveBeenCalled();
    expect(payment.handlePaystackWebhook).not.toHaveBeenCalled();
  });
});
