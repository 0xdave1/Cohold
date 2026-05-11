import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './prisma/prisma.service';
import configuration from './config/configuration';
import { EmailModule } from './modules/email/email.module';
import { GatewayModule } from './modules/gateway/gateway.module';
import { OutboxModule } from './modules/outbox/outbox.module';
import { OutboxService } from './modules/outbox/outbox.service';
import { AdminJwtGuard } from './common/guards/admin-jwt.guard';
import { AdminRoleGuard } from './common/guards/admin-role.guard';
import { RolesGuard } from './common/guards/roles.guard';

/** Smoke: same import graph as AppModule for outbox + gateways (catches OutboxService DI regressions). */
describe('AppModule outbox DI smoke', () => {
  it('resolves OutboxService when GatewayModule precedes OutboxModule (Render-like order)', async () => {
    const mockPrisma = {
      outboxEvent: {
        upsert: jest.fn(),
        findMany: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
      },
      notificationDelivery: { upsert: jest.fn(), update: jest.fn() },
      user: { findUnique: jest.fn() },
      scheduledJobState: { upsert: jest.fn(), update: jest.fn(), findMany: jest.fn() },
    };

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

    expect(moduleRef.get(OutboxService)).toBeDefined();
  });
});
