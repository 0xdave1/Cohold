import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { SupportService } from './support.service';
import { SupportController } from './support.controller';
import { SupportAdminController } from './support.admin.controller';
import { SupportAdminGuard } from './guards/support-admin.guard';
import { SupportGateway } from './support.gateway';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [PrismaModule, StorageModule, JwtModule.register({})],
  controllers: [SupportController, SupportAdminController],
  providers: [SupportService, SupportAdminGuard, SupportGateway],
  exports: [SupportService],
})
export class SupportModule {}

