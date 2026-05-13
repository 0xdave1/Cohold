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
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AdminJwtGuard } from '../../common/guards/admin-jwt.guard';
import { AdminRoleGuard } from '../../common/guards/admin-role.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminRole, WithdrawalStatus } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PresignPropertyImageDto } from './dto/presign-property-image.dto';
import { CompletePropertyImageDto } from './dto/complete-property-image.dto';
import { PresignPropertyDocumentDto } from './dto/presign-property-document.dto';
import { CompletePropertyDocumentDto } from './dto/complete-property-document.dto';
import { KycReviewDto } from '../kyc/dto/kyc-review.dto';
import { ActionReasonDto } from './dto/action-reason.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { AdminRbacMatrix } from './admin-rbac.matrix';

@ApiTags('admin')
@ApiBearerAuth('admin-jwt')
@UseGuards(AdminJwtGuard, AdminRoleGuard, RolesGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Roles(...AdminRbacMatrix.users.read)
  @Get('dashboard/overview')
  async overview() {
    return this.adminService.getDashboardOverviewV2();
  }

  @Roles(...AdminRbacMatrix.users.read)
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

  @Roles(...AdminRbacMatrix.users.read)
  @Get('users/:id')
  async userDetail(@Param('id') id: string) {
    return this.adminService.getUserDetail(id);
  }

  @Roles(...AdminRbacMatrix.users.read)
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

  @Roles(...AdminRbacMatrix.users.freeze)
  @Post('users/:id/suspend')
  async suspendUser(
    @Param('id') id: string,
    @CurrentUser() admin: { id: string },
    @Body() body: ActionReasonDto,
  ) {
    return this.adminService.suspendUser(id, admin.id, body.reason);
  }

  @Roles(...AdminRbacMatrix.users.freeze)
  @Post('users/:id/freeze')
  async freezeUser(
    @Param('id') id: string,
    @CurrentUser() admin: { id: string },
    @Body() body: ActionReasonDto,
  ) {
    return this.adminService.freezeUser(id, admin.id, body.reason);
  }

  @Roles(...AdminRbacMatrix.users.unfreeze)
  @Post('users/:id/unfreeze')
  async unfreezeUser(
    @Param('id') id: string,
    @CurrentUser() admin: { id: string },
    @Body() body: ActionReasonDto,
  ) {
    return this.adminService.unfreezeUser(id, admin.id, body.reason);
  }

  @Roles(AdminRole.SUPER_ADMIN)
  @Delete('users/:id')
  async deleteUser(
    @Param('id') id: string,
    @CurrentUser() admin: { id: string },
    @Body() body: ActionReasonDto,
    @Req() req: Request,
  ) {
    return this.adminService.deleteUser(id, admin.id, body.reason, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
    });
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

  @Roles(...AdminRbacMatrix.kyc.review)
  @Post('verifications/:id/approve')
  async approveKyc(
    @Param('id') id: string,
    @CurrentUser() admin: { id: string },
    @Req() req: Request,
  ) {
    return this.adminService.approveVerification(id, admin.id, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
    });
  }

  @Roles(...AdminRbacMatrix.kyc.review)
  @Post('verifications/:id/reject')
  async rejectKyc(
    @Param('id') id: string,
    @CurrentUser() admin: { id: string },
    @Body() dto: KycReviewDto,
    @Req() req: Request,
  ) {
    return this.adminService.rejectVerification(id, admin.id, dto, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
    });
  }

  @Roles(AdminRole.APPROVER, AdminRole.COMPLIANCE_ADMIN, AdminRole.SUPER_ADMIN)
  @Get('users/:userId/kyc-documents/:slot/signed-read')
  async kycDocumentSignedRead(
    @Param('userId') userId: string,
    @Param('slot') slot: string,
    @CurrentUser() admin: { id: string },
    @Req() req: Request,
  ) {
    if (slot !== 'ID_FRONT' && slot !== 'ID_BACK' && slot !== 'SELFIE') {
      throw new BadRequestException('Invalid document slot');
    }
    return this.adminService.getKycDocumentSignedReadUrl(admin.id, userId, slot, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
    });
  }

  @Roles(...AdminRbacMatrix.virtualAccounts.retry)
  @Post('users/:userId/virtual-account/retry')
  async retryVirtualAccountProvisioning(
    @Param('userId') userId: string,
    @CurrentUser() admin: { id: string },
    @Body() body: ActionReasonDto,
  ) {
    return this.adminService.adminRetryVirtualAccountProvisioning(userId, admin.id, body.reason);
  }

  @Roles(AdminRole.APPROVER, AdminRole.COMPLIANCE_ADMIN, AdminRole.SUPER_ADMIN)
  @Get('virtual-accounts/failed')
  async failedVirtualAccounts(@Query('limit') limit = '50') {
    return this.adminService.adminListFailedVirtualAccounts(parseInt(limit, 10));
  }

  @Roles(AdminRole.APPROVER, AdminRole.COMPLIANCE_ADMIN, AdminRole.SUPER_ADMIN)
  @Get('virtual-accounts/unmatched-deposits')
  async unmatchedVirtualAccountDeposits(@Query('limit') limit = '100') {
    return this.adminService.adminListUnmatchedVirtualAccountDeposits(parseInt(limit, 10));
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

  @Roles(...AdminRbacMatrix.adminManagement.mutate)
  @Post('admins')
  async createAdmin(@CurrentUser() admin: { id: string }, @Body() body: CreateAdminDto, @Req() req: Request) {
    return this.adminService.createAdmin(admin.id, body, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
    });
  }

  @Roles(...AdminRbacMatrix.adminManagement.mutate)
  @Patch('admins/:id')
  async updateAdmin(
    @Param('id') id: string,
    @CurrentUser() admin: { id: string },
    @Body() body: UpdateAdminDto,
    @Req() req: Request,
  ) {
    return this.adminService.updateAdmin(admin.id, id, body, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
    });
  }

  @Roles(...AdminRbacMatrix.adminManagement.mutate)
  @Post('admins/:id/suspend')
  async suspendAdmin(
    @Param('id') id: string,
    @CurrentUser() admin: { id: string },
    @Body() body: ActionReasonDto,
    @Req() req: Request,
  ) {
    return this.adminService.suspendAdmin(id, admin.id, body.reason, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
    });
  }

  @Roles(...AdminRbacMatrix.adminManagement.mutate)
  @Post('admins/:id/deactivate')
  async deactivateAdmin(
    @Param('id') id: string,
    @CurrentUser() admin: { id: string },
    @Body() body: ActionReasonDto,
    @Req() req: Request,
  ) {
    return this.adminService.deactivateAdmin(id, admin.id, body.reason, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
    });
  }

  @Roles(...AdminRbacMatrix.withdrawals.read)
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

  @Roles(...AdminRbacMatrix.withdrawals.reconcile)
  @Post('withdrawals/:id/reconcile')
  async reconcileWithdrawal(
    @Param('id') id: string,
    @CurrentUser() admin: { id: string },
    @Body() body: ActionReasonDto,
    @Req() req: Request,
  ) {
    return this.adminService.adminReconcileWithdrawal(id, admin.id, body.reason, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
    });
  }

  @Roles(AdminRole.SUPER_ADMIN)
  @Get('ledger/reconciliation')
  async ledgerReconciliation() {
    return this.adminService.getLedgerReconciliationReport();
  }

  @Roles(AdminRole.SUPER_ADMIN, AdminRole.COMPLIANCE_ADMIN)
  @Get('ops/summary')
  async financialOpsSummary() {
    return this.adminService.getFinancialOpsSummary();
  }

  @Roles(AdminRole.SUPER_ADMIN, AdminRole.COMPLIANCE_ADMIN)
  @Get('launch-readiness')
  async launchReadiness() {
    return this.adminService.getLaunchReadiness();
  }

  @Roles(AdminRole.SUPER_ADMIN)
  @Post('withdrawals/reconcile-stale')
  async reconcileStaleWithdrawals(
    @CurrentUser() admin: { id: string },
    @Body() body: ActionReasonDto,
    @Req() req: Request,
    @Query('olderThanMinutes') olderThanMinutes?: string,
  ) {
    return this.adminService.adminReconcileStaleWithdrawals(
      admin.id,
      body.reason,
      olderThanMinutes ? parseInt(olderThanMinutes, 10) : undefined,
      {
        ipAddress: req.ip,
        userAgent: req.get('user-agent') ?? undefined,
      },
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
    @Body() body: ActionReasonDto,
    @Req() req: Request,
  ) {
    return this.adminService.closeProperty(id, admin.id, body.reason, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
    });
  }

  @Roles(...AdminRbacMatrix.properties.publish)
  @Post('properties/:id/publish')
  async publishProperty(
    @Param('id') id: string,
    @CurrentUser() admin: { id: string },
    @Req() req: Request,
  ) {
    return this.adminService.publishProperty(id, admin.id, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
    });
  }

  @Roles(...AdminRbacMatrix.properties.unpublish)
  @Post('properties/:id/unpublish')
  async unpublishProperty(
    @Param('id') id: string,
    @CurrentUser() admin: { id: string },
    @Body() body: ActionReasonDto,
    @Req() req: Request,
  ) {
    return this.adminService.unpublishProperty(id, admin.id, body.reason, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
    });
  }

  @Roles(AdminRole.APPROVER, AdminRole.COMPLIANCE_ADMIN, AdminRole.SUPER_ADMIN)
  @Delete('properties/:id')
  async deleteProperty(
    @Param('id') id: string,
    @CurrentUser() admin: { id: string },
    @Body() body: ActionReasonDto,
    @Req() req: Request,
  ) {
    return this.adminService.softDeleteProperty(id, admin.id, body.reason, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
    });
  }
}

