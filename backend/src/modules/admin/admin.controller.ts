import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../../common/guards/admin-role.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminRole, WithdrawalStatus } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PresignPropertyImageDto } from './dto/presign-property-image.dto';
import { CompletePropertyImageDto } from './dto/complete-property-image.dto';
import { PresignPropertyDocumentDto } from './dto/presign-property-document.dto';
import { CompletePropertyDocumentDto } from './dto/complete-property-document.dto';

@ApiTags('admin')
@ApiBearerAuth('admin-jwt')
@UseGuards(JwtAuthGuard, AdminRoleGuard, RolesGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Roles(AdminRole.DATA_UPLOADER, AdminRole.APPROVER, AdminRole.COMPLIANCE_ADMIN, AdminRole.SUPER_ADMIN)
  @Get('dashboard/overview')
  async overview() {
    return this.adminService.getDashboardOverviewV2();
  }

  @Roles(AdminRole.DATA_UPLOADER, AdminRole.APPROVER, AdminRole.COMPLIANCE_ADMIN, AdminRole.SUPER_ADMIN)
  @Get('users')
  async listUsers(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('kycStatus') kycStatus?: string,
  ) {
    return this.adminService.listUsers({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      kycStatus,
    });
  }

  @Roles(AdminRole.DATA_UPLOADER, AdminRole.APPROVER, AdminRole.COMPLIANCE_ADMIN, AdminRole.SUPER_ADMIN)
  @Get('users/:id')
  async userDetail(@Param('id') id: string) {
    return this.adminService.getUserDetail(id);
  }

  @Roles(AdminRole.DATA_UPLOADER, AdminRole.APPROVER, AdminRole.COMPLIANCE_ADMIN, AdminRole.SUPER_ADMIN)
  @Get('users/:id/transactions')
  async userTransactions(
    @Param('id') id: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.adminService.listUserTransactions(id, {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
  }

  @Roles(AdminRole.APPROVER, AdminRole.COMPLIANCE_ADMIN, AdminRole.SUPER_ADMIN)
  @Post('users/:id/suspend')
  async suspendUser(@Param('id') id: string) {
    return this.adminService.suspendUser(id);
  }

  @Roles(AdminRole.SUPER_ADMIN)
  @Delete('users/:id')
  async deleteUser(@Param('id') id: string) {
    return this.adminService.deleteUser(id);
  }

  @Roles(AdminRole.DATA_UPLOADER, AdminRole.APPROVER, AdminRole.COMPLIANCE_ADMIN, AdminRole.SUPER_ADMIN)
  @Get('verifications')
  async listVerifications(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.adminService.listVerifications({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
  }

  @Roles(AdminRole.APPROVER, AdminRole.COMPLIANCE_ADMIN, AdminRole.SUPER_ADMIN)
  @Post('verifications/:id/approve')
  async approveKyc(@Param('id') id: string, @CurrentUser() admin: { id: string }) {
    return this.adminService.approveVerification(id, admin.id);
  }

  @Roles(AdminRole.APPROVER, AdminRole.COMPLIANCE_ADMIN, AdminRole.SUPER_ADMIN)
  @Post('verifications/:id/reject')
  async rejectKyc(@Param('id') id: string, @CurrentUser() admin: { id: string }) {
    return this.adminService.rejectVerification(id, admin.id);
  }

  @Roles(AdminRole.DATA_UPLOADER, AdminRole.APPROVER, AdminRole.COMPLIANCE_ADMIN, AdminRole.SUPER_ADMIN)
  @Get('wallet-transactions')
  async walletTransactions(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.adminService.listWalletTransactions({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
  }

  @Roles(AdminRole.DATA_UPLOADER, AdminRole.APPROVER, AdminRole.COMPLIANCE_ADMIN, AdminRole.SUPER_ADMIN)
  @Get('admins')
  async listAdmins(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('role') role?: 'SUPER_ADMIN' | 'FINANCE_ADMIN' | 'OPERATION_ADMIN' | 'COMPLIANCE_ADMIN',
    @Query('status') status?: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE',
    @Query('period') period?: 'today' | '7d' | '30d' | '180d',
    @Query('search') search?: string,
  ) {
    return this.adminService.listAdmins({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      role,
      status,
      period,
      search,
    });
  }

  @Roles(AdminRole.DATA_UPLOADER, AdminRole.APPROVER, AdminRole.COMPLIANCE_ADMIN, AdminRole.SUPER_ADMIN)
  @Get('admins/:id')
  async adminDetail(@Param('id') id: string) {
    return this.adminService.getAdminDetail(id);
  }

  @Roles(AdminRole.SUPER_ADMIN)
  @Post('admins')
  async createAdmin(
    @Body()
    body: {
      fullName?: string;
      email: string;
      phoneNumber?: string | null;
      role: 'SUPER_ADMIN' | 'FINANCE_ADMIN' | 'OPERATION_ADMIN' | 'COMPLIANCE_ADMIN';
    },
  ) {
    return this.adminService.createAdmin(body);
  }

  @Roles(AdminRole.SUPER_ADMIN)
  @Patch('admins/:id')
  async updateAdmin(
    @Param('id') id: string,
    @Body()
    body: {
      fullName?: string;
      email?: string;
      phoneNumber?: string | null;
      role?: 'SUPER_ADMIN' | 'FINANCE_ADMIN' | 'OPERATION_ADMIN' | 'COMPLIANCE_ADMIN';
    },
  ) {
    return this.adminService.updateAdmin(id, body);
  }

  @Roles(AdminRole.APPROVER, AdminRole.COMPLIANCE_ADMIN, AdminRole.SUPER_ADMIN)
  @Post('admins/:id/suspend')
  async suspendAdmin(@Param('id') id: string, @CurrentUser() admin: { id: string }) {
    return this.adminService.suspendAdmin(id, admin.id);
  }

  @Roles(AdminRole.SUPER_ADMIN)
  @Post('admins/:id/deactivate')
  async deactivateAdmin(@Param('id') id: string, @CurrentUser() admin: { id: string }) {
    return this.adminService.deactivateAdmin(id, admin.id);
  }

  @Roles(AdminRole.DATA_UPLOADER, AdminRole.APPROVER, AdminRole.COMPLIANCE_ADMIN, AdminRole.SUPER_ADMIN)
  @Get('withdrawals')
  async listWithdrawals(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('status') status?: string,
    @Query('stuckOnly') stuckOnly?: string,
    @Query('olderThanMinutes') olderThanMinutes?: string,
  ) {
    let parsedStatus: WithdrawalStatus | undefined;
    if (status) {
      if (!Object.values(WithdrawalStatus).includes(status as WithdrawalStatus)) {
        throw new BadRequestException('Invalid withdrawal status filter');
      }
      parsedStatus = status as WithdrawalStatus;
    }
    return this.adminService.adminListWithdrawals({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      status: parsedStatus,
      stuckOnly: stuckOnly === '1' || stuckOnly === 'true',
      olderThanMinutes: olderThanMinutes ? parseInt(olderThanMinutes, 10) : undefined,
    });
  }

  @Roles(AdminRole.SUPER_ADMIN, AdminRole.APPROVER)
  @Post('withdrawals/:id/reconcile')
  async reconcileWithdrawal(@Param('id') id: string, @CurrentUser() admin: { id: string }) {
    return this.adminService.adminReconcileWithdrawal(id, admin.id);
  }

  @Roles(AdminRole.SUPER_ADMIN)
  @Get('ledger/reconciliation')
  async ledgerReconciliation() {
    return this.adminService.getLedgerReconciliationReport();
  }

  @Roles(AdminRole.SUPER_ADMIN)
  @Post('withdrawals/reconcile-stale')
  async reconcileStaleWithdrawals(
    @CurrentUser() admin: { id: string },
    @Query('olderThanMinutes') olderThanMinutes?: string,
  ) {
    return this.adminService.adminReconcileStaleWithdrawals(
      admin.id,
      olderThanMinutes ? parseInt(olderThanMinutes, 10) : undefined,
    );
  }

  @Roles(AdminRole.DATA_UPLOADER, AdminRole.APPROVER, AdminRole.COMPLIANCE_ADMIN, AdminRole.SUPER_ADMIN)
  @Get('activity-log')
  async activityLog(
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    return this.adminService.getActivityLog(
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }

  @Roles(AdminRole.DATA_UPLOADER, AdminRole.APPROVER, AdminRole.COMPLIANCE_ADMIN, AdminRole.SUPER_ADMIN)
  @Get('disputes')
  async disputes(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.adminService.listDisputes({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
  }

  @Roles(AdminRole.DATA_UPLOADER, AdminRole.APPROVER, AdminRole.COMPLIANCE_ADMIN, AdminRole.SUPER_ADMIN)
  @Get('properties')
  async listProperties(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('period') period?: string,
  ) {
    return this.adminService.listProperties({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      status,
      type,
      period,
    });
  }

  @Roles(AdminRole.DATA_UPLOADER, AdminRole.APPROVER, AdminRole.COMPLIANCE_ADMIN, AdminRole.SUPER_ADMIN)
  @Get('properties/:id')
  async propertyDetail(@Param('id') id: string) {
    return this.adminService.getPropertyDetail(id);
  }

  @Roles(AdminRole.DATA_UPLOADER, AdminRole.APPROVER, AdminRole.COMPLIANCE_ADMIN, AdminRole.SUPER_ADMIN)
  @Post('properties/:id/images/presign')
  async presignPropertyImage(@Param('id') id: string, @Body() dto: PresignPropertyImageDto) {
    return this.adminService.presignPropertyImage(id, dto);
  }

  @Roles(AdminRole.DATA_UPLOADER, AdminRole.APPROVER, AdminRole.COMPLIANCE_ADMIN, AdminRole.SUPER_ADMIN)
  @Post('properties/:id/images/complete')
  async completePropertyImage(@Param('id') id: string, @Body() dto: CompletePropertyImageDto) {
    return this.adminService.completePropertyImage(id, dto);
  }

  @Roles(AdminRole.DATA_UPLOADER, AdminRole.APPROVER, AdminRole.COMPLIANCE_ADMIN, AdminRole.SUPER_ADMIN)
  @Post('properties/:id/documents/presign')
  async presignPropertyDocument(@Param('id') id: string, @Body() dto: PresignPropertyDocumentDto) {
    return this.adminService.presignPropertyDocument(id, dto);
  }

  @Roles(AdminRole.DATA_UPLOADER, AdminRole.APPROVER, AdminRole.COMPLIANCE_ADMIN, AdminRole.SUPER_ADMIN)
  @Post('properties/:id/documents/complete')
  async completePropertyDocument(@Param('id') id: string, @Body() dto: CompletePropertyDocumentDto) {
    return this.adminService.completePropertyDocument(id, dto);
  }

  @Roles(AdminRole.DATA_UPLOADER, AdminRole.APPROVER, AdminRole.COMPLIANCE_ADMIN, AdminRole.SUPER_ADMIN)
  @Get('properties/:id/investors')
  async propertyInvestors(
    @Param('id') id: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.adminService.listPropertyInvestors(id, {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
  }

  @Roles(AdminRole.APPROVER, AdminRole.COMPLIANCE_ADMIN, AdminRole.SUPER_ADMIN)
  @Post('properties/:id/close')
  async closeProperty(
    @Param('id') id: string,
    @CurrentUser() admin: { id: string },
  ) {
    return this.adminService.closeProperty(id, admin.id);
  }

  @Roles(AdminRole.APPROVER, AdminRole.COMPLIANCE_ADMIN, AdminRole.SUPER_ADMIN)
  @Delete('properties/:id')
  async deleteProperty(
    @Param('id') id: string,
    @CurrentUser() admin: { id: string },
  ) {
    return this.adminService.softDeleteProperty(id, admin.id);
  }
}

