import { Test } from '@nestjs/testing';
import { NotificationType } from '@prisma/client';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../../prisma/prisma.service';
import { OutboxService } from '../outbox/outbox.service';

describe('NotificationsService listUserNotifications (Issue 12)', () => {
  let service: NotificationsService;
  let findMany: jest.Mock;
  let count: jest.Mock;

  beforeEach(async () => {
    findMany = jest.fn().mockResolvedValue([]);
    count = jest.fn().mockResolvedValue(0);
    const prisma = {
      notification: { findMany, count },
    } as unknown as PrismaService;
    const outbox = {} as unknown as OutboxService;
    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: OutboxService, useValue: outbox },
      ],
    }).compile();
    service = moduleRef.get(NotificationsService);
  });

  it('caps limit at 100', async () => {
    await service.listUserNotifications('u1', { page: 1, limit: 999 });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 100,
      }),
    );
  });

  it('applies type and user scoping in where', async () => {
    await service.listUserNotifications('u1', {
      type: NotificationType.WALLET_FUNDED,
      isRead: true,
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'u1',
          type: NotificationType.WALLET_FUNDED,
          isRead: true,
        }),
      }),
    );
  });

  it('unreadOnly wins over isRead filter', async () => {
    await service.listUserNotifications('u1', {
      unreadOnly: true,
      isRead: true,
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'u1',
          isRead: false,
        }),
      }),
    );
  });
});
