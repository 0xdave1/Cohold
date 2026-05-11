import * as fs from 'fs';
import * as path from 'path';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { AdminJwtGuard } from '../../common/guards/admin-jwt.guard';
import { AdminRoleGuard } from '../../common/guards/admin-role.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { NotificationChannel } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import configuration from '../../config/configuration';
import { EmailModule } from '../email/email.module';
import { GatewayModule } from '../gateway/gateway.module';
import { WebSocketDeliveryService } from '../gateway/websocket-delivery.service';
import { OutboxModule } from './outbox.module';
import { OutboxService } from './outbox.service';

/** Minimal prisma surface for OutboxService + OutboxWorker + JobRegistryService construction. */
function createMockPrisma() {
  return {
    outboxEvent: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
    },
    notificationDelivery: {
      upsert: jest.fn(),
      update: jest.fn(),
    },
    user: { findUnique: jest.fn() },
    scheduledJobState: {
      upsert: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
  };
}

describe('OutboxModule (DI)', () => {
  it('OutboxModule source does not register UserGateway (single instance from GatewayModule)', () => {
    const src = fs.readFileSync(path.join(__dirname, 'outbox.module.ts'), 'utf8');
    expect(src).not.toContain('UserGateway');
  });

  it('compiles and resolves OutboxService with WebSocketDeliveryService from GatewayModule', async () => {
    const mockPrisma = createMockPrisma();
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
        EmailModule,
        GatewayModule,
        OutboxModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .overrideGuard(AdminJwtGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AdminRoleGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    const outbox = moduleRef.get(OutboxService);
    const delivery = moduleRef.get(WebSocketDeliveryService);
    expect(outbox).toBeInstanceOf(OutboxService);
    expect(delivery).toBeInstanceOf(WebSocketDeliveryService);
  });

  it('processes NOTIFICATION_DELIVERY WEBSOCKET when websocket enabled (mock WebSocketDeliveryService)', async () => {
    const emitToUser = jest.fn();

    const mockPrisma = createMockPrisma();
    mockPrisma.notificationDelivery.upsert.mockResolvedValue({ id: 'd1' });
    mockPrisma.notificationDelivery.update.mockResolvedValue({});

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
        EmailModule,
        GatewayModule,
        OutboxModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .overrideProvider(WebSocketDeliveryService)
      .useValue({ emitToUser })
      .overrideGuard(AdminJwtGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AdminRoleGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    const outbox = moduleRef.get(OutboxService);
    await outbox.processEvent({
      id: 'evt-1',
      type: 'NOTIFICATION_DELIVERY',
      payload: {
        channel: NotificationChannel.WEBSOCKET,
        notificationId: 'n1',
        userId: 'user-1',
        event: 'notification',
        data: { title: 'Hello' },
      } as any,
    });

    expect(emitToUser).toHaveBeenCalledWith('user-1', 'notification', { title: 'Hello' });
    expect(mockPrisma.outboxEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'evt-1' },
        data: expect.objectContaining({ status: 'COMPLETED' }),
      }),
    );
  });
});
