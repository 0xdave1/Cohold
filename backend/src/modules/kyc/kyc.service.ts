import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SubmitBvnDto } from './dto/submit-bvn.dto';
import { KycStatus } from '@prisma/client';
import { KycReviewDto } from './dto/kyc-review.dto';
import { StorageService } from '../storage/storage.service';
import { EmailService } from '../email/email.service';
import { SubmitNinDto } from './dto/submit-nin.dto';
import { WalletService } from '../wallet/wallet.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PresignKycUploadDto } from './dto/presign-kyc-upload.dto';
import { CompleteKycUploadDto } from './dto/complete-kyc-upload.dto';
import { assertValidUpload, extensionFromFileName } from '../storage/upload-validation';

@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly emailService: EmailService,
    private readonly walletService: WalletService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async submitBvn(userId: string, dto: SubmitBvnDto) {
    // BVN validation/verification integration would go here; never log full BVN.
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.kycStatus === KycStatus.VERIFIED) {
      throw new BadRequestException('KYC already verified');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        bvn: dto.bvn,
        kycStatus: KycStatus.PENDING,
      },
    });

    await this.prisma.kycVerification.upsert({
      where: { userId },
      update: {
        status: KycStatus.PENDING,
        governmentIdType: 'BVN',
        governmentIdNumber: dto.bvn,
      },
      create: {
        userId,
        status: KycStatus.PENDING,
        governmentIdType: 'BVN',
        governmentIdNumber: dto.bvn,
      },
    });

    return { status: KycStatus.PENDING };
  }

  async submitNin(userId: string, dto: SubmitNinDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.kycStatus === KycStatus.VERIFIED) {
      throw new BadRequestException('KYC already verified');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { kycStatus: KycStatus.PENDING },
    });

    await this.prisma.kycVerification.upsert({
      where: { userId },
      update: {
        status: KycStatus.PENDING,
        governmentIdType: 'NIN',
        governmentIdNumber: dto.nin,
      },
      create: {
        userId,
        status: KycStatus.PENDING,
        governmentIdType: 'NIN',
        governmentIdNumber: dto.nin,
      },
    });

    return { status: KycStatus.PENDING };
  }

  /**
   * Upload KYC document (ID front/back or selfie).
   * Legacy multipart endpoint (kept for compatibility). Prefer presign/complete flow.
   */
  async uploadDocument(
    userId: string,
    documentType: 'id-front' | 'id-back' | 'selfie',
    file: import('../../types/multer').MulterFile,
  ): Promise<{ documentKey: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Validate file
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new BadRequestException('File size exceeds 5MB limit');
    }

    const allowedMimes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type. Only JPEG, PNG, or PDF allowed');
    }

    // Upload to S3/R2
    const key = this.storageService.generateKycDocumentKeyLegacy(userId, documentType);
    await this.storageService.uploadDocument(key, file.buffer, file.mimetype);

    // Update KYC verification record
    await this.prisma.kycVerification.upsert({
      where: { userId },
      update: {
        documentKey: documentType === 'id-front' ? key : undefined,
        // For MVP, store single documentKey; extend to multiple keys if needed
      },
      create: {
        userId,
        status: KycStatus.PENDING,
        documentKey: key,
      },
    });

    return { documentKey: key };
  }

  async presignKycUpload(userId: string, dto: PresignKycUploadDto) {
    const docType =
      dto.docType === 'ID_FRONT' ? 'ID_FRONT'
      : dto.docType === 'ID_BACK' ? 'ID_BACK'
      : 'SELFIE';

    assertValidUpload({
      category: 'kycDocument',
      contentType: dto.contentType,
      fileSize: dto.fileSize,
      fileName: dto.fileName,
    });

    const ext = extensionFromFileName(dto.fileName) || (dto.contentType === 'application/pdf' ? 'pdf' : 'jpg');
    const key = this.storageService.generateKycDocumentKey(userId, docType, ext);
    const uploadUrl = await this.storageService.createPresignedUploadUrl(key, dto.contentType, 900);
    return { key, uploadUrl, expiresIn: 900 };
  }

  async completeKycUpload(userId: string, dto: CompleteKycUploadDto) {
    const key = dto.key;
    if (!key.startsWith(`users/${userId}/kyc/`)) {
      throw new BadRequestException('Invalid upload key');
    }

    const patch =
      dto.docType === 'ID_FRONT'
        ? { documentFrontKey: key, documentKey: key }
        : dto.docType === 'ID_BACK'
          ? { documentBackKey: key, documentKey: key }
          : { selfieKey: key, documentKey: key };

    await this.prisma.kycVerification.upsert({
      where: { userId },
      update: {
        status: KycStatus.PENDING,
        ...patch,
      },
      create: {
        userId,
        status: KycStatus.PENDING,
        ...patch,
      },
    });

    return { status: KycStatus.PENDING };
  }

  async approveKyc(adminId: string, userId: string, _dto: KycReviewDto) {
    const kyc = await this.prisma.kycVerification.findUnique({
      where: { userId },
    });
    if (!kyc) {
      throw new NotFoundException('KYC record not found');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const kycVerification = await tx.kycVerification.update({
        where: { userId },
        data: {
          status: KycStatus.VERIFIED,
          requiresReview: false,
          failureReason: null,
          reviewedById: adminId,
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: {
          kycStatus: KycStatus.VERIFIED,
          onboardingCompletedAt: new Date(),
        },
      });

      await tx.adminActivityLog.create({
        data: {
          adminId,
          action: 'KYC_APPROVE',
          entityType: 'User',
          entityId: userId,
        },
      });

      return kycVerification;
    });

    // Create dedicated virtual account after KYC approval (outside tx to avoid long-running)
    try {
      await this.walletService.createVirtualAccount(userId);
    } catch (err) {
      this.logger.warn(`Failed to create virtual account for user ${userId}:`, err);
    }

    // Send approval email
    await this.emailService.sendKycStatusEmail(user.email, 'approved');

    // Send KYC approved notification
    try {
      await this.notificationsService.notifyKycApproved(userId);
    } catch (err) {
      this.logger.warn(`Failed to send KYC approved notification: ${err}`);
    }

    return updated;
  }

  async rejectKyc(adminId: string, userId: string, dto: KycReviewDto) {
    if (!dto.failureReason) {
      throw new BadRequestException('failureReason is required when rejecting');
    }

    const kyc = await this.prisma.kycVerification.findUnique({
      where: { userId },
    });
    if (!kyc) {
      throw new NotFoundException('KYC record not found');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const kycVerification = await tx.kycVerification.update({
        where: { userId },
        data: {
          status: KycStatus.FAILED,
          requiresReview: true,
          failureReason: dto.failureReason,
          reviewedById: adminId,
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: { kycStatus: KycStatus.FAILED },
      });

      await tx.adminActivityLog.create({
        data: {
          adminId,
          action: 'KYC_REJECT',
          entityType: 'User',
          entityId: userId,
          metadata: {
            failureReason: dto.failureReason,
          },
        },
      });

      return kycVerification;
    });

    // Send KYC rejected notification
    try {
      await this.notificationsService.notifyKycRejected(userId, dto.failureReason);
    } catch (err) {
      this.logger.warn(`Failed to send KYC rejected notification: ${err}`);
    }

    return updated;
  }
}

