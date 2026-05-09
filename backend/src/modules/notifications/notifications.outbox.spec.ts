import { NotificationType } from '@prisma/client';
import { NotificationsService } from './notifications.service';

describe('NotificationsService outbox integration', () => {
  const prisma = {
    notification: {
      create: jest.fn(),
    },
  } as any;

  const outbox = {
    enqueue: jest.fn(),
  } as any;

  let service: NotificationsService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new NotificationsService(prisma, outbox);
    prisma.notification.create.mockResolvedValue({
      id: 'n1',
      type: NotificationType.WALLET_FUNDED,
      title: 'Wallet Funded',
      message: 'ok',
      isRead: false,
      readAt: null,
      link: null,
      metadata: {},
      createdAt: new Date(),
    });
  });

  it('wallet funding notification enqueues durable email side effect', async () => {
    await service.notifyWalletFunded('u1', '100.00', 'NGN', 'lop1');
    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: 'EMAIL:WALLET_FUNDED:lop1',
        type: 'NOTIFICATION_DELIVERY',
      }),
    );
  });

  it('kyc rejection payload is sanitized (no raw long identity digits)', async () => {
    prisma.notification.create.mockResolvedValue({
      id: 'n2',
      type: NotificationType.KYC_REJECTED,
      title: 'KYC Verification Failed',
      message: 'sanitized',
      isRead: false,
      readAt: null,
      link: null,
      metadata: {},
      createdAt: new Date(),
    });
    await service.notifyKycRejected('u1', 'NIN 12345678901 invalid');
    const call = outbox.enqueue.mock.calls[0][0];
    expect(JSON.stringify(call.payload)).not.toContain('12345678901');
  });
});
