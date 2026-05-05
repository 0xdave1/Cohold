import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IdentityType,
  IdentityVerificationStatus,
  KycStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SubmitBvnDto } from './dto/submit-bvn.dto';
import { KycReviewDto } from './dto/kyc-review.dto';
import { StorageService } from '../storage/storage.service';
import { EmailService } from '../email/email.service';
import { SubmitNinDto } from './dto/submit-nin.dto';
import { WalletService } from '../wallet/wallet.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PresignKycUploadDto } from './dto/presign-kyc-upload.dto';
import { CompleteKycUploadDto } from './dto/complete-kyc-upload.dto';
import { KycIdentityCryptoService } from './kyc-identity-crypto.service';
import {
  hasAllRequiredSlotsUploaded,
  KYC_SLOT_ORDER,
  legacyDocKeyField,
  parseDocumentSlots,
  type KycDocumentSlotState,
  type KycSlotKey,
} from './kyc-doc-slots.helper';
import {
  IdentityCryptoError,
  maskIdentityLast4,
  normalizeIdentity,
  validateIdentityFormat,
  type IdentityKind,
} from './kyc-identity-crypto.util';
import { KYC_IDENTITY_VERIFIER, type KycIdentityVerifier } from './kyc-identity-verifier.interface';

const ALLOWED_KYC_MIMES = new Set(['image/jpeg', 'image/png', 'application/pdf']);
const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'pdf']);

@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly emailService: EmailService,
    private readonly walletService: WalletService,
    private readonly notificationsService: NotificationsService,
    private readonly identityCrypto: KycIdentityCryptoService,
    private readonly configService: ConfigService,
    @Inject(KYC_IDENTITY_VERIFIER) private readonly identityVerifier: KycIdentityVerifier,
  ) {}

  private maxDocBytes(): number {
    return this.configService.get<number>('config.kyc.maxDocumentBytes') ?? 5 * 1024 * 1024;
  }

  private bucketName(): string {
    return this.configService.get<string>('config.s3.bucket') ?? 'cohold-assets';
  }

  private assertKeyOwnedByUser(userId: string, key: string): void {
    const prefix = `users/${userId}/kyc/`;
    if (!key.startsWith(prefix)) {
      throw new BadRequestException('Invalid storage key for this user');
    }
  }

  private extensionFromFileName(fileName: string): string {
    const base = fileName.split(/[/\\]/).pop() ?? '';
    const parts = base.split('.');
    if (parts.length < 2) {
      throw new BadRequestException('File name must include an extension');
    }
    const ext = parts.pop()!.toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      throw new BadRequestException('Only jpg, jpeg, png, or pdf uploads are allowed');
    }
    return ext;
  }

  private mapDocTypeToFolder(docType: KycSlotKey): string {
    if (docType === 'ID_FRONT') return 'id_front';
    if (docType === 'ID_BACK') return 'id_back';
    return 'selfie';
  }

  private async writeAuditLog(
    tx: Prisma.TransactionClient,
    params: {
      kycVerificationId: string;
      userId: string;
      actorAdminId?: string | null;
      action: string;
      previousKycStatus: KycStatus;
      nextKycStatus: KycStatus;
      reason?: string | null;
      metadata?: Prisma.InputJsonValue;
      ipAddress?: string | null;
      userAgent?: string | null;
    },
  ): Promise<void> {
    await tx.kycAuditLog.create({
      data: {
        kycVerificationId: params.kycVerificationId,
        userId: params.userId,
        actorAdminId: params.actorAdminId ?? null,
        action: params.action,
        previousKycStatus: params.previousKycStatus,
        nextKycStatus: params.nextKycStatus,
        reason: params.reason ?? null,
        metadata: params.metadata ?? Prisma.JsonNull,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
      },
    });
  }

  private assertReadyForAdminApproval(kyc: {
    status: KycStatus;
    identityHash: string | null;
    identityVerificationStatus: IdentityVerificationStatus;
    documentFrontKey: string | null;
    documentBackKey: string | null;
    selfieKey: string | null;
    kycDocumentSlots: Prisma.JsonValue | null;
  }): void {
    if (kyc.status === KycStatus.VERIFIED) {
      throw new BadRequestException('KYC already verified');
    }
    if (kyc.status === KycStatus.FAILED) {
      throw new BadRequestException('KYC was rejected; the user must resubmit');
    }
    if (kyc.status !== KycStatus.REQUIRES_REVIEW) {
      throw new BadRequestException('KYC must be queued for manual review before approval');
    }
    if (!kyc.identityHash) {
      throw new BadRequestException('Identity is incomplete; cannot approve');
    }
    const slots = parseDocumentSlots(kyc.kycDocumentSlots);
    if (!hasAllRequiredSlotsUploaded(slots, kyc)) {
      throw new BadRequestException('Required KYC documents are missing or not uploaded');
    }
    if (kyc.identityVerificationStatus === IdentityVerificationStatus.FAILED) {
      throw new BadRequestException('Identity verification failed; cannot approve');
    }
  }

  private async maybePromoteToManualReview(
    tx: Prisma.TransactionClient,
    kyc: {
      id: string;
      userId: string;
      status: KycStatus;
      identityHash: string | null;
      documentFrontKey: string | null;
      documentBackKey: string | null;
      selfieKey: string | null;
      kycDocumentSlots: Prisma.JsonValue | null;
    },
  ): Promise<void> {
    if (kyc.status === KycStatus.FAILED || kyc.status === KycStatus.VERIFIED) {
      return;
    }
    if (!kyc.identityHash) return;
    const slots = parseDocumentSlots(kyc.kycDocumentSlots);
    if (!hasAllRequiredSlotsUploaded(slots, kyc)) return;
    const previousStatus = kyc.status;

    await tx.kycVerification.update({
      where: { id: kyc.id },
      data: {
        status: KycStatus.REQUIRES_REVIEW,
        requiresReview: true,
      },
    });
    await this.writeAuditLog(tx, {
      kycVerificationId: kyc.id,
      userId: kyc.userId,
      action: 'KYC_AUTO_REVIEW_QUEUE',
      previousKycStatus: previousStatus,
      nextKycStatus: KycStatus.REQUIRES_REVIEW,
      metadata: { trigger: 'identity+required_documents_ready' },
    });
  }

  private maskResponse(last4: string | null): string {
    if (!last4) return '****';
    return `****${last4}`;
  }

  async submitBvn(userId: string, dto: SubmitBvnDto) {
    const kind: IdentityKind = 'BVN';
    let normalized: string;
    try {
      normalized = normalizeIdentity(dto.bvn, kind);
      validateIdentityFormat(normalized, kind);
    } catch (e) {
      if (e instanceof IdentityCryptoError) {
        throw new BadRequestException(e.message);
      }
      throw e;
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.kycStatus === KycStatus.VERIFIED) {
      throw new BadRequestException('KYC already verified');
    }
    if (user.isFrozen) {
      throw new ForbiddenException('Account is disabled');
    }

    const hash = this.identityCrypto.hashIdentity(kind, normalized);
    const other = await this.prisma.kycVerification.findFirst({
      where: { identityHash: hash, NOT: { userId } },
      select: { userId: true },
    });
    if (other) {
      throw new ConflictException({
        code: 'IDENTITY_IN_USE',
        message: 'This identity may already be linked to another account',
      });
    }

    let encrypted: string;
    try {
      encrypted = this.identityCrypto.encryptSensitiveIdentity(normalized);
    } catch (e) {
      if (e instanceof IdentityCryptoError) {
        throw new BadRequestException('Identity encryption is not configured');
      }
      throw e;
    }

    const verify = await this.identityVerifier.verify({
      type: kind,
      normalized,
      userId,
    });

    const last4 = maskIdentityLast4(normalized);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          kycStatus: KycStatus.PENDING,
          bvn: null,
        },
      });

      const existing = await tx.kycVerification.findUnique({ where: { userId } });
      const nextSlots = parseDocumentSlots(existing?.kycDocumentSlots ?? null);

      const kycRow = await tx.kycVerification.upsert({
        where: { userId },
        update: {
          status: KycStatus.PENDING,
          failureReason: null,
          governmentIdNumber: null,
          identityType: IdentityType.BVN,
          identityEncrypted: encrypted,
          identityHash: hash,
          identityLast4: last4,
          identityProviderReference: verify.providerReference ?? null,
          identityVerifiedAt: verify.status === IdentityVerificationStatus.VERIFIED ? new Date() : null,
          identityVerificationStatus: verify.status,
          kycDocumentSlots: nextSlots as Prisma.InputJsonValue,
        },
        create: {
          userId,
          status: KycStatus.PENDING,
          identityType: IdentityType.BVN,
          identityEncrypted: encrypted,
          identityHash: hash,
          identityLast4: last4,
          identityProviderReference: verify.providerReference ?? null,
          identityVerifiedAt: verify.status === IdentityVerificationStatus.VERIFIED ? new Date() : null,
          identityVerificationStatus: verify.status,
          governmentIdNumber: null,
        },
      });

      await this.maybePromoteToManualReview(tx, kycRow);
    });

    return {
      status: KycStatus.PENDING,
      identityMasked: this.maskResponse(last4),
      identityVerificationStatus: verify.status,
    };
  }

  async submitNin(userId: string, dto: SubmitNinDto) {
    const kind: IdentityKind = 'NIN';
    let normalized: string;
    try {
      normalized = normalizeIdentity(dto.nin, kind);
      validateIdentityFormat(normalized, kind);
    } catch (e) {
      if (e instanceof IdentityCryptoError) {
        throw new BadRequestException(e.message);
      }
      throw e;
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.kycStatus === KycStatus.VERIFIED) {
      throw new BadRequestException('KYC already verified');
    }
    if (user.isFrozen) {
      throw new ForbiddenException('Account is disabled');
    }

    const hash = this.identityCrypto.hashIdentity(kind, normalized);
    const other = await this.prisma.kycVerification.findFirst({
      where: { identityHash: hash, NOT: { userId } },
      select: { userId: true },
    });
    if (other) {
      throw new ConflictException({
        code: 'IDENTITY_IN_USE',
        message: 'This identity may already be linked to another account',
      });
    }

    let encrypted: string;
    try {
      encrypted = this.identityCrypto.encryptSensitiveIdentity(normalized);
    } catch (e) {
      if (e instanceof IdentityCryptoError) {
        throw new BadRequestException('Identity encryption is not configured');
      }
      throw e;
    }
    const verify = await this.identityVerifier.verify({
      type: kind,
      normalized,
      userId,
    });
    const last4 = maskIdentityLast4(normalized);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { kycStatus: KycStatus.PENDING, bvn: null },
      });

      const existing = await tx.kycVerification.findUnique({ where: { userId } });
      const nextSlots = parseDocumentSlots(existing?.kycDocumentSlots ?? null);

      const kycRow = await tx.kycVerification.upsert({
        where: { userId },
        update: {
          status: KycStatus.PENDING,
          failureReason: null,
          governmentIdNumber: null,
          identityType: IdentityType.NIN,
          identityEncrypted: encrypted,
          identityHash: hash,
          identityLast4: last4,
          identityProviderReference: verify.providerReference ?? null,
          identityVerifiedAt: verify.status === IdentityVerificationStatus.VERIFIED ? new Date() : null,
          identityVerificationStatus: verify.status,
          kycDocumentSlots: nextSlots as Prisma.InputJsonValue,
        },
        create: {
          userId,
          status: KycStatus.PENDING,
          identityType: IdentityType.NIN,
          identityEncrypted: encrypted,
          identityHash: hash,
          identityLast4: last4,
          identityProviderReference: verify.providerReference ?? null,
          identityVerifiedAt: verify.status === IdentityVerificationStatus.VERIFIED ? new Date() : null,
          identityVerificationStatus: verify.status,
          governmentIdNumber: null,
        },
      });

      await this.maybePromoteToManualReview(tx, kycRow);
    });

    return {
      status: KycStatus.PENDING,
      identityMasked: this.maskResponse(last4),
      identityVerificationStatus: verify.status,
    };
  }

  async uploadDocument(
    userId: string,
    documentType: 'id-front' | 'id-back' | 'selfie',
    file: import('../../types/multer').MulterFile,
  ): Promise<{ documentKey: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.isFrozen) {
      throw new ForbiddenException('Account is disabled');
    }
    if (!file) {
      throw new BadRequestException('File is required');
    }
    const maxSize = this.maxDocBytes();
    if (file.size > maxSize) {
      throw new BadRequestException('File exceeds maximum allowed size');
    }
    if (!ALLOWED_KYC_MIMES.has(file.mimetype)) {
      throw new BadRequestException('Invalid file type. Only JPEG, PNG, or PDF allowed');
    }

    const slot: KycSlotKey =
      documentType === 'id-front' ? 'ID_FRONT' : documentType === 'id-back' ? 'ID_BACK' : 'SELFIE';
    const ext =
      file.mimetype === 'image/png' ? 'png' : file.mimetype === 'application/pdf' ? 'pdf' : 'jpg';
    const key = this.storageService.generateKycDocumentKey(userId, this.mapDocTypeToFolder(slot), ext);
    await this.storageService.uploadDocument(key, file.buffer, file.mimetype);

    const now = new Date().toISOString();
    const head = await this.storageService.headObject(key).catch(() => null);

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.kycVerification.findUnique({ where: { userId } });
      const slots = parseDocumentSlots(existing?.kycDocumentSlots ?? null);
      const meta: KycDocumentSlotState = {
        storageKey: key,
        bucket: this.bucketName(),
        contentType: file.mimetype,
        sizeBytes: file.size,
        etag: head?.etag,
        uploadedAt: now,
        lastModified: head?.lastModified?.toISOString(),
        status: 'UPLOADED',
        malwareScanStatus: 'NOT_CONFIGURED',
      };
      slots[slot] = meta;

      const legacyField = legacyDocKeyField(slot);
      const kycRow = await tx.kycVerification.upsert({
        where: { userId },
        update: {
          [legacyField]: key,
          kycDocumentSlots: slots as Prisma.InputJsonValue,
          status: KycStatus.PENDING,
        },
        create: {
          userId,
          status: KycStatus.PENDING,
          [legacyField]: key,
          kycDocumentSlots: slots as Prisma.InputJsonValue,
        },
      });
      await this.maybePromoteToManualReview(tx, kycRow);
    });

    return { documentKey: key };
  }

  async presignKycUpload(userId: string, dto: PresignKycUploadDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.isFrozen) throw new ForbiddenException('Account is disabled');
    if (user.kycStatus === KycStatus.VERIFIED) {
      throw new BadRequestException('KYC already verified');
    }
    if (dto.fileSize > this.maxDocBytes()) {
      throw new BadRequestException('Requested file size exceeds maximum allowed');
    }
    if (!ALLOWED_KYC_MIMES.has(dto.contentType)) {
      throw new BadRequestException('Unsupported content type');
    }

    const ext = this.extensionFromFileName(dto.fileName);
    const key = this.storageService.generateKycDocumentKey(
      userId,
      this.mapDocTypeToFolder(dto.docType),
      ext,
    );
    this.assertKeyOwnedByUser(userId, key);

    const uploadUrl = await this.storageService.createPresignedUploadUrl(key, dto.contentType, 900);
    const issuedAt = new Date().toISOString();

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.kycVerification.findUnique({ where: { userId } });
      const slots = parseDocumentSlots(existing?.kycDocumentSlots ?? null);
      const pending: KycDocumentSlotState = {
        storageKey: key,
        bucket: this.bucketName(),
        expectedContentType: dto.contentType,
        expectedMaxBytes: dto.fileSize,
        presignedIssuedAt: issuedAt,
        status: 'PENDING_PUT',
        malwareScanStatus: 'NOT_CONFIGURED',
      };
      slots[dto.docType] = pending;
      await tx.kycVerification.upsert({
        where: { userId },
        update: {
          kycDocumentSlots: slots as Prisma.InputJsonValue,
          status: KycStatus.PENDING,
        },
        create: {
          userId,
          status: KycStatus.PENDING,
          kycDocumentSlots: slots as Prisma.InputJsonValue,
        },
      });
    });

    return { uploadUrl, key, expiresInSeconds: 900 };
  }

  async completeKycUpload(userId: string, dto: CompleteKycUploadDto) {
    this.assertKeyOwnedByUser(userId, dto.key);

    const head = await this.storageService.headObject(dto.key).catch(() => null);
    if (!head?.contentLength) {
      throw new BadRequestException('Object not found or not yet available in storage');
    }

    const kyc = await this.prisma.kycVerification.findUnique({ where: { userId } });
    if (!kyc) {
      throw new BadRequestException('KYC record not found');
    }
    const slots = parseDocumentSlots(kyc.kycDocumentSlots);
    const pending = slots[dto.docType];
    if (!pending || pending.storageKey !== dto.key) {
      throw new BadRequestException('Upload does not match the active presigned key for this document slot');
    }
    if (pending.status !== 'PENDING_PUT') {
      throw new BadRequestException('This upload slot is not awaiting completion');
    }
    if (pending.expectedContentType && head.contentType && head.contentType !== pending.expectedContentType) {
      throw new BadRequestException('Content-Type does not match presigned upload');
    }
    if (dto.contentType !== head.contentType) {
      throw new BadRequestException('Declared content type does not match stored object');
    }
    if (head.contentLength > this.maxDocBytes()) {
      throw new BadRequestException('Object exceeds maximum allowed size');
    }
    if (dto.sizeBytes !== head.contentLength) {
      throw new BadRequestException('Declared size does not match stored object');
    }
    if (pending.expectedMaxBytes && head.contentLength > pending.expectedMaxBytes) {
      throw new BadRequestException('Object is larger than presigned allowance');
    }
    if (dto.etag && head.etag && dto.etag.replace(/"/g, '') !== head.etag.replace(/"/g, '')) {
      throw new BadRequestException('ETag mismatch');
    }

    if (pending.presignedIssuedAt && head.lastModified) {
      const issued = new Date(pending.presignedIssuedAt).getTime();
      if (head.lastModified.getTime() + 2000 < issued) {
        throw new BadRequestException('Object timestamp is inconsistent with presign issuance');
      }
    }

    const now = new Date().toISOString();
    const legacyField = legacyDocKeyField(dto.docType);

    const updated = await this.prisma.$transaction(async (tx) => {
      const fresh = await tx.kycVerification.findUniqueOrThrow({ where: { userId } });
      const s = parseDocumentSlots(fresh.kycDocumentSlots);
      const cur = s[dto.docType];
      if (!cur || cur.storageKey !== dto.key) {
        throw new BadRequestException('Upload slot changed during completion');
      }
      s[dto.docType] = {
        ...cur,
        status: 'UPLOADED',
        contentType: head.contentType ?? dto.contentType,
        sizeBytes: head.contentLength,
        etag: head.etag,
        uploadedAt: now,
        lastModified: head.lastModified?.toISOString(),
        malwareScanStatus: 'NOT_CONFIGURED',
      };

      const row = await tx.kycVerification.update({
        where: { userId },
        data: {
          [legacyField]: dto.key,
          kycDocumentSlots: s as Prisma.InputJsonValue,
        },
      });
      await this.maybePromoteToManualReview(tx, row);
      return row;
    });

    return { ok: true, docType: dto.docType, status: updated.status };
  }

  async approveKyc(
    adminId: string,
    userId: string,
    _dto: KycReviewDto,
    auditCtx?: { ipAddress?: string | null; userAgent?: string | null },
  ) {
    return this.approveKycInternal(adminId, { userId }, auditCtx);
  }

  async approveKycByVerificationId(
    adminId: string,
    verificationId: string,
    _dto: KycReviewDto,
    auditCtx?: { ipAddress?: string | null; userAgent?: string | null },
  ) {
    return this.approveKycInternal(adminId, { verificationId }, auditCtx);
  }

  private async approveKycInternal(
    adminId: string,
    lookup: { userId?: string; verificationId?: string },
    auditCtx?: { ipAddress?: string | null; userAgent?: string | null },
  ) {
    const kyc = await this.prisma.kycVerification.findFirst({
      where: lookup.userId ? { userId: lookup.userId } : { id: lookup.verificationId },
    });
    if (!kyc) {
      throw new NotFoundException('KYC record not found');
    }
    const user = await this.prisma.user.findUnique({ where: { id: kyc.userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.isFrozen) {
      throw new ForbiddenException('Account is disabled');
    }

    this.assertReadyForAdminApproval(kyc);

    const userId = kyc.userId;
    const prev = kyc.status;

    const updated = await this.prisma.$transaction(async (tx) => {
      const kycVerification = await tx.kycVerification.update({
        where: { id: kyc.id },
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

      await this.writeAuditLog(tx, {
        kycVerificationId: kyc.id,
        userId,
        actorAdminId: adminId,
        action: 'KYC_APPROVE',
        previousKycStatus: prev,
        nextKycStatus: KycStatus.VERIFIED,
        metadata: { path: lookup.verificationId ? 'verificationId' : 'userId' },
        ipAddress: auditCtx?.ipAddress ?? null,
        userAgent: auditCtx?.userAgent ?? null,
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

    try {
      await this.walletService.createVirtualAccount(userId);
    } catch (err) {
      this.logger.warn(`Failed to create virtual account for user ${userId}:`, err);
    }

    await this.emailService.sendKycStatusEmail(user.email, 'approved');
    try {
      await this.notificationsService.notifyKycApproved(userId);
    } catch (err) {
      this.logger.warn(`Failed to send KYC approved notification: ${err}`);
    }

    return this.sanitizeKycRecordForResponse(updated);
  }

  async rejectKyc(
    adminId: string,
    userId: string,
    dto: KycReviewDto,
    auditCtx?: { ipAddress?: string | null; userAgent?: string | null },
  ) {
    return this.rejectKycInternal(adminId, { userId }, dto, auditCtx);
  }

  async rejectKycByVerificationId(
    adminId: string,
    verificationId: string,
    dto: KycReviewDto,
    auditCtx?: { ipAddress?: string | null; userAgent?: string | null },
  ) {
    return this.rejectKycInternal(adminId, { verificationId }, dto, auditCtx);
  }

  private async rejectKycInternal(
    adminId: string,
    lookup: { userId?: string; verificationId?: string },
    dto: KycReviewDto,
    auditCtx?: { ipAddress?: string | null; userAgent?: string | null },
  ) {
    const reason = dto.failureReason?.trim() || 'Rejected by administrator';
    const kyc = await this.prisma.kycVerification.findFirst({
      where: lookup.userId ? { userId: lookup.userId } : { id: lookup.verificationId },
    });
    if (!kyc) {
      throw new NotFoundException('KYC record not found');
    }
    if (kyc.status === KycStatus.VERIFIED) {
      throw new BadRequestException('Cannot reject verified KYC; revoke instead');
    }

    const prev = kyc.status;
    const userId = kyc.userId;

    const updated = await this.prisma.$transaction(async (tx) => {
      const kycVerification = await tx.kycVerification.update({
        where: { id: kyc.id },
        data: {
          status: KycStatus.FAILED,
          requiresReview: true,
          failureReason: reason,
          reviewedById: adminId,
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: { kycStatus: KycStatus.FAILED },
      });

      await this.writeAuditLog(tx, {
        kycVerificationId: kyc.id,
        userId,
        actorAdminId: adminId,
        action: 'KYC_REJECT',
        previousKycStatus: prev,
        nextKycStatus: KycStatus.FAILED,
        reason,
        ipAddress: auditCtx?.ipAddress ?? null,
        userAgent: auditCtx?.userAgent ?? null,
      });

      await tx.adminActivityLog.create({
        data: {
          adminId,
          action: 'KYC_REJECT',
          entityType: 'User',
          entityId: userId,
          metadata: { failureReason: reason },
        },
      });

      return kycVerification;
    });

    try {
      await this.notificationsService.notifyKycRejected(userId, reason);
    } catch (err) {
      this.logger.warn(`Failed to send KYC rejected notification: ${err}`);
    }

    return this.sanitizeKycRecordForResponse(updated);
  }

  async revokeKyc(
    adminId: string,
    userId: string,
    dto: KycReviewDto,
    auditCtx?: { ipAddress?: string | null; userAgent?: string | null },
  ) {
    const reason = dto.failureReason?.trim() || 'KYC verification revoked';
    const kyc = await this.prisma.kycVerification.findUnique({ where: { userId } });
    if (!kyc) throw new NotFoundException('KYC record not found');
    if (kyc.status !== KycStatus.VERIFIED) {
      throw new BadRequestException('Only verified KYC can be revoked');
    }
    const prev = kyc.status;

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.kycVerification.update({
        where: { userId },
        data: {
          status: KycStatus.REQUIRES_REVIEW,
          requiresReview: true,
          failureReason: reason,
          reviewedById: adminId,
        },
      });
      await tx.user.update({
        where: { id: userId },
        data: { kycStatus: KycStatus.REQUIRES_REVIEW },
      });
      await this.writeAuditLog(tx, {
        kycVerificationId: kyc.id,
        userId,
        actorAdminId: adminId,
        action: 'KYC_REVOKE',
        previousKycStatus: prev,
        nextKycStatus: KycStatus.REQUIRES_REVIEW,
        reason,
        ipAddress: auditCtx?.ipAddress ?? null,
        userAgent: auditCtx?.userAgent ?? null,
      });
      return row;
    });

    return this.sanitizeKycRecordForResponse(updated);
  }

  sanitizeKycRecordForResponse(kyc: {
    id: string;
    userId: string;
    status: KycStatus;
    identityLast4: string | null;
    identityVerificationStatus: IdentityVerificationStatus;
    identityType: IdentityType | null;
    identityProviderReference: string | null;
    identityVerifiedAt: Date | null;
    failureReason: string | null;
    requiresReview: boolean;
    reviewedById: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: kyc.id,
      userId: kyc.userId,
      status: kyc.status,
      identityMasked: this.maskResponse(kyc.identityLast4),
      identityType: kyc.identityType,
      identityVerificationStatus: kyc.identityVerificationStatus,
      identityProviderReference: kyc.identityProviderReference,
      identityVerifiedAt: kyc.identityVerifiedAt,
      failureReason: kyc.failureReason,
      requiresReview: kyc.requiresReview,
      reviewedById: kyc.reviewedById,
      createdAt: kyc.createdAt,
      updatedAt: kyc.updatedAt,
    };
  }

  /**
   * NDPR-oriented export: metadata only — never returns ciphertext, hash, or legacy plaintext fields.
   */
  async exportSanitizedKycMetadata(userId: string) {
    const kyc = await this.prisma.kycVerification.findUnique({ where: { userId } });
    if (!kyc) return { userId, kyc: null };
    return {
      userId,
      kyc: {
        status: kyc.status,
        identityType: kyc.identityType,
        identityMasked: this.maskResponse(kyc.identityLast4),
        identityVerificationStatus: kyc.identityVerificationStatus,
        identityVerifiedAt: kyc.identityVerifiedAt,
        identityProviderReference: kyc.identityProviderReference,
        identityDataRetentionUntil: kyc.identityDataRetentionUntil,
        documentSlots: Object.fromEntries(
          KYC_SLOT_ORDER.map((slot) => {
            const s = parseDocumentSlots(kyc.kycDocumentSlots)[slot];
            return [
              slot,
              s
                ? {
                    status: s.status,
                    malwareScanStatus: s.malwareScanStatus,
                    uploadedAt: s.uploadedAt,
                    sizeBytes: s.sizeBytes,
                    contentType: s.contentType,
                  }
                : null,
            ];
          }),
        ),
        updatedAt: kyc.updatedAt,
      },
    };
  }

  /**
   * Clears reversible identity material while retaining auditability markers where policy requires.
   * Call from a future account-deletion / erasure job — not invoked automatically today.
   */
  async anonymizeKycSensitiveFields(userId: string): Promise<void> {
    await this.prisma.kycVerification.updateMany({
      where: { userId },
      data: {
        identityEncrypted: null,
        identityHash: null,
        identityLast4: null,
        identityProviderReference: null,
        governmentIdNumber: null,
      },
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: { bvn: null },
    });
  }

  async getAdminKycDocumentSignedReadUrl(
    _adminId: string,
    userId: string,
    slot: KycSlotKey,
    _auditCtx?: { ipAddress?: string | null; userAgent?: string | null },
  ): Promise<{ url: string; expiresInSeconds: number }> {
    const kyc = await this.prisma.kycVerification.findUnique({ where: { userId } });
    if (!kyc) throw new NotFoundException('KYC record not found');
    const slots = parseDocumentSlots(kyc.kycDocumentSlots);
    const key =
      slots[slot]?.storageKey ??
      (slot === 'ID_FRONT'
        ? kyc.documentFrontKey
        : slot === 'ID_BACK'
          ? kyc.documentBackKey
          : kyc.selfieKey);
    if (!key) {
      throw new NotFoundException('Document not found for this slot');
    }
    this.assertKeyOwnedByUser(userId, key);
    const url = await this.storageService.createSignedReadUrl(key, 300);
    return { url, expiresInSeconds: 300 };
  }
}
