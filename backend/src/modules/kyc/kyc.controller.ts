import {
  Body,
  Controller,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { KycService } from './kyc.service';
import type { MulterFile } from '../../types/multer';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminJwtGuard } from '../../common/guards/admin-jwt.guard';
import { AdminRoleGuard } from '../../common/guards/admin-role.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SubmitBvnDto } from './dto/submit-bvn.dto';
import { SubmitNinDto } from './dto/submit-nin.dto';
import { KycReviewDto } from './dto/kyc-review.dto';
import { PresignKycUploadDto } from './dto/presign-kyc-upload.dto';
import { CompleteKycUploadDto } from './dto/complete-kyc-upload.dto';

@ApiTags('kyc')
@Controller()
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @ApiBearerAuth('user-jwt')
  @UseGuards(JwtAuthGuard)
  @Post('kyc/bvn')
  async submitBvn(
    @CurrentUser() user: { id: string },
    @Body() dto: SubmitBvnDto,
  ) {
    return this.kycService.submitBvn(user.id, dto);
  }

  @ApiBearerAuth('user-jwt')
  @UseGuards(JwtAuthGuard)
  @Post('kyc/nin')
  async submitNin(
    @CurrentUser() user: { id: string },
    @Body() dto: SubmitNinDto,
  ) {
    return this.kycService.submitNin(user.id, dto);
  }

  @ApiBearerAuth('user-jwt')
  @UseGuards(JwtAuthGuard)
  @Post('kyc/upload-document')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  async uploadDocument(
    @CurrentUser() user: { id: string },
    @UploadedFile() file: MulterFile,
    @Body('documentType') documentType: 'id-front' | 'id-back' | 'selfie',
  ) {
    return this.kycService.uploadDocument(user.id, documentType, file);
  }

  @ApiBearerAuth('user-jwt')
  @UseGuards(JwtAuthGuard)
  @Post('kyc/uploads/presign')
  async presign(@CurrentUser() user: { id: string }, @Body() dto: PresignKycUploadDto) {
    return this.kycService.presignKycUpload(user.id, dto);
  }

  @ApiBearerAuth('user-jwt')
  @UseGuards(JwtAuthGuard)
  @Post('kyc/uploads/complete')
  async complete(@CurrentUser() user: { id: string }, @Body() dto: CompleteKycUploadDto) {
    return this.kycService.completeKycUpload(user.id, dto);
  }

  @ApiBearerAuth('admin-jwt')
  @UseGuards(AdminJwtGuard, AdminRoleGuard, RolesGuard)
  @Roles(AdminRole.APPROVER, AdminRole.COMPLIANCE_ADMIN, AdminRole.SUPER_ADMIN)
  @Patch('admin/users/:id/kyc-approve')
  async approve(
    @CurrentUser() admin: { id: string },
    @Param('id') userId: string,
    @Body() dto: KycReviewDto,
    @Req() req: Request,
  ) {
    return this.kycService.approveKyc(admin.id, userId, dto, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
    });
  }

  @ApiBearerAuth('admin-jwt')
  @UseGuards(AdminJwtGuard, AdminRoleGuard, RolesGuard)
  @Roles(AdminRole.APPROVER, AdminRole.COMPLIANCE_ADMIN, AdminRole.SUPER_ADMIN)
  @Patch('admin/users/:id/kyc-reject')
  async reject(
    @CurrentUser() admin: { id: string },
    @Param('id') userId: string,
    @Body() dto: KycReviewDto,
    @Req() req: Request,
  ) {
    return this.kycService.rejectKyc(admin.id, userId, dto, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
    });
  }
}

