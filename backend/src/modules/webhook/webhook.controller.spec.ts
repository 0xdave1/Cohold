import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { WebhookController } from './webhook.controller';
import { PaymentService } from '../payment/payment.service';
import { WithdrawalService } from '../withdrawal/withdrawal.service';
import { PAYOUT_PROVIDER } from '../payout/payout-provider.interface';

describe('WebhookController', () => {
  it('rejects invalid webhook signature', async () => {
    const payment = { handleFlutterwaveWebhook: jest.fn() };
    const withdrawal = { handlePayoutWebhook: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      controllers: [WebhookController],
      providers: [
        { provide: PaymentService, useValue: payment },
        { provide: WithdrawalService, useValue: withdrawal },
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
    const req = { rawBody: Buffer.from('{}') } as Request & { rawBody: Buffer };
    await expect(
      controller.handleFlutterwaveWebhook('bad', {}, req, { event: 'charge.completed' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(payment.handleFlutterwaveWebhook).not.toHaveBeenCalled();
    expect(withdrawal.handlePayoutWebhook).not.toHaveBeenCalled();
  });

  it('rejects oversized webhook payload before processing', async () => {
    const payment = { handleFlutterwaveWebhook: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      controllers: [WebhookController],
      providers: [
        { provide: PaymentService, useValue: payment },
        { provide: WithdrawalService, useValue: { handlePayoutWebhook: jest.fn() } },
        {
          provide: PAYOUT_PROVIDER,
          useValue: {
            verifyWebhookSignature: jest.fn().mockReturnValue(true),
            parseTransferWebhook: jest.fn().mockReturnValue(null),
          },
        },
      ],
    }).compile();

    const controller = moduleRef.get(WebhookController);
    const req = {
      rawBody: Buffer.from('{}'),
      headers: { 'content-length': `${1024 * 1024 + 1}` },
    } as Request & { rawBody: Buffer };
    await expect(
      controller.handleFlutterwaveWebhook('sig', {}, req, { event: 'charge.completed' }),
    ).rejects.toThrow('Webhook body too large');
    expect(payment.handleFlutterwaveWebhook).not.toHaveBeenCalled();
  });
});
