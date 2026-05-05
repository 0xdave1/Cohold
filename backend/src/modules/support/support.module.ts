import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { WsModule } from '../../common/ws/ws.module';
import { SupportService } from './support.service';
import { SupportController } from './support.controller';
import { SupportAdminController } from './support.admin.controller';
import { SupportAdminGuard } from './guards/support-admin.guard';
import { SupportGateway } from './support.gateway';
import { StorageModule } from '../storage/storage.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, StorageModule, NotificationsModule, WsModule],
  controllers: [SupportController, SupportAdminController],
  providers: [SupportService, SupportAdminGuard, SupportGateway],
  exports: [SupportService],
})
export class SupportModule {}

