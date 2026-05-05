import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { IdentityType, IdentityVerificationStatus, KycStatus } from '@prisma/client';
import { KycService } from './kyc.service';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { EmailService } from '../email/email.service';
import { WalletService } from '../wallet/wallet.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ConfigService } from '@nestjs/config';
import { KycIdentityCryptoService } from './kyc-identity-crypto.service';
import { KYC_IDENTITY_VERIFIER } from './kyc-identity-verifier.interface';

describe('KycService (Issue 5)', () => {
  let service: KycService;

  const prismaMock = {
    user: { findUnique: jest.fn(), update: jest.fn() },
    kycVerification: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const storageMock = {
    generateKycDocumentKey: jest.fn().mockReturnValue('users/u1/kyc/id_front/file.jpg'),
    uploadDocument: jest.fn(),
    headObject: jest.fn(),
    createPresignedUploadUrl: jest.fn().mockResolvedValue('https://upload'),
    createSignedReadUrl: jest.fn().mockResolvedValue('https://signed'),
  };
  const emailMock = { sendKycStatusEmail: jest.fn(), sendOtpEmail: jest.fn() };
  const walletMock = { createVirtualAccount: jest.fn() };
  const notificationsMock = { notifyKycApproved: jest.fn(), notifyKycRejected: jest.fn() };
  const configMock = {
    get: jest.fn((key: string) => {
      const map: Record<string, unknown> = {
        'config.kyc.maxDocumentBytes': 1024,
        'config.s3.bucket': 'test-bucket',
      };
      return map[key];
    }),
  };
  const cryptoMock = {
    hashIdentity: jest.fn().mockReturnValue('hash-1'),
    encryptSensitiveIdentity: jest.fn().mockReturnValue('enc-1'),
  };
  const verifierMock = {
    verify: jest.fn().mockResolvedValue({
      status: IdentityVerificationStatus.MANUAL_REVIEW,
      providerReference: 'manual-ref',
    }),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    configMock.get.mockImplementation((key: string) => {
      const map: Record<string, unknown> = {
        'config.kyc.maxDocumentBytes': 1024,
        'config.s3.bucket': 'test-bucket',
      };
      return map[key];
    });
    cryptoMock.hashIdentity.mockReturnValue('hash-1');
    cryptoMock.encryptSensitiveIdentity.mockReturnValue('enc-1');
    verifierMock.verify.mockResolvedValue({
      status: IdentityVerificationStatus.MANUAL_REVIEW,
      providerReference: 'manual-ref',
    });

    prismaMock.$transaction.mockImplementation(async (cb: any) =>
      cb({
        user: { update: jest.fn() },
        kycVerification: {
          findUnique: jest.fn().mockResolvedValue(null),
          upsert: jest.fn().mockResolvedValue({
            id: 'kyc-1',
            userId: 'u1',
            status: KycStatus.PENDING,
            identityHash: 'hash-1',
            documentFrontKey: null,
            documentBackKey: null,
            selfieKey: null,
            kycDocumentSlots: null,
          }),
          update: jest.fn().mockResolvedValue({
            id: 'kyc-1',
            userId: 'u1',
            status: KycStatus.VERIFIED,
            identityLast4: '8901',
            identityType: IdentityType.BVN,
            identityVerificationStatus: IdentityVerificationStatus.MANUAL_REVIEW,
            identityProviderReference: 'manual-ref',
            identityVerifiedAt: null,
            failureReason: null,
            requiresReview: false,
            reviewedById: 'adm1',
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
          findUniqueOrThrow: jest.fn().mockResolvedValue({
            userId: 'u1',
            kycDocumentSlots: {
              ID_FRONT: {
                storageKey: 'users/u1/kyc/id_front/file.jpg',
                status: 'PENDING_PUT',
                expectedContentType: 'image/jpeg',
                expectedMaxBytes: 1024,
                presignedIssuedAt: new Date().toISOString(),
              },
            },
          }),
        },
        kycAuditLog: { create: jest.fn() },
        adminActivityLog: { create: jest.fn() },
      }),
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        KycService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: StorageService, useValue: storageMock },
        { provide: EmailService, useValue: emailMock },
        { provide: WalletService, useValue: walletMock },
        { provide: NotificationsService, useValue: notificationsMock },
        { provide: ConfigService, useValue: configMock },
        { provide: KycIdentityCryptoService, useValue: cryptoMock },
        { provide: KYC_IDENTITY_VERIFIER, useValue: verifierMock },
      ],
    }).compile();
    service = moduleRef.get(KycService);
  });

  it('does not persist plaintext BVN fields on submit', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', kycStatus: KycStatus.PENDING, isFrozen: false });
    prismaMock.kycVerification.findFirst.mockResolvedValue(null);
    const txCtx: any = {
      user: { update: jest.fn() },
      kycVerification: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({
          id: 'kyc-1',
          userId: 'u1',
          status: KycStatus.PENDING,
          identityHash: 'hash-1',
          documentFrontKey: null,
          documentBackKey: null,
          selfieKey: null,
          kycDocumentSlots: null,
        }),
        update: jest.fn(),
      },
      kycAuditLog: { create: jest.fn() },
    };
    prismaMock.$transaction.mockImplementation(async (cb: any) => cb(txCtx));

    await service.submitBvn('u1', { bvn: '12345678901' });

    expect(txCtx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ bvn: null }),
      }),
    );
    expect(txCtx.kycVerification.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          governmentIdNumber: null,
          identityEncrypted: 'enc-1',
          identityHash: 'hash-1',
        }),
      }),
    );
  });

  it('blocks duplicate identity hash across accounts', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', kycStatus: KycStatus.PENDING, isFrozen: false });
    prismaMock.kycVerification.findFirst.mockResolvedValue({ userId: 'another-user' });
    await expect(service.submitNin('u1', { nin: '12345678901' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('approval without required documents fails', async () => {
    prismaMock.kycVerification.findFirst.mockResolvedValue({
      id: 'kyc-1',
      userId: 'u1',
      status: KycStatus.REQUIRES_REVIEW,
      identityHash: 'hash-1',
      identityVerificationStatus: IdentityVerificationStatus.MANUAL_REVIEW,
      documentFrontKey: null,
      documentBackKey: null,
      selfieKey: null,
      kycDocumentSlots: null,
    });
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', isFrozen: false, email: 'u@x.co' });
    await expect(service.approveKyc('adm1', 'u1', {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('admin approval writes KYC audit log', async () => {
    prismaMock.kycVerification.findFirst.mockResolvedValue({
      id: 'kyc-1',
      userId: 'u1',
      status: KycStatus.REQUIRES_REVIEW,
      identityHash: 'hash-1',
      identityVerificationStatus: IdentityVerificationStatus.MANUAL_REVIEW,
      documentFrontKey: 'users/u1/kyc/id_front/a.jpg',
      documentBackKey: 'users/u1/kyc/id_back/b.jpg',
      selfieKey: 'users/u1/kyc/selfie/c.jpg',
      kycDocumentSlots: null,
    });
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', isFrozen: false, email: 'u@x.co' });
    const txCtx: any = {
      kycVerification: {
        update: jest.fn().mockResolvedValue({
          id: 'kyc-1',
          userId: 'u1',
          status: KycStatus.VERIFIED,
          identityLast4: '8901',
          identityType: IdentityType.BVN,
          identityVerificationStatus: IdentityVerificationStatus.MANUAL_REVIEW,
          identityProviderReference: null,
          identityVerifiedAt: null,
          failureReason: null,
          requiresReview: false,
          reviewedById: 'adm1',
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      },
      user: { update: jest.fn() },
      kycAuditLog: { create: jest.fn() },
      adminActivityLog: { create: jest.fn() },
    };
    prismaMock.$transaction.mockImplementation(async (cb: any) => cb(txCtx));

    await service.approveKyc('adm1', 'u1', {});

    expect(txCtx.kycAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'KYC_APPROVE',
          previousKycStatus: KycStatus.REQUIRES_REVIEW,
          nextKycStatus: KycStatus.VERIFIED,
        }),
      }),
    );
  });

  it('admin rejection writes KYC audit log', async () => {
    prismaMock.kycVerification.findFirst.mockResolvedValue({
      id: 'kyc-1',
      userId: 'u1',
      status: KycStatus.REQUIRES_REVIEW,
      identityHash: 'hash-1',
      identityVerificationStatus: IdentityVerificationStatus.MANUAL_REVIEW,
      documentFrontKey: 'users/u1/kyc/id_front/a.jpg',
      documentBackKey: 'users/u1/kyc/id_back/b.jpg',
      selfieKey: 'users/u1/kyc/selfie/c.jpg',
      kycDocumentSlots: null,
    });
    const txCtx: any = {
      kycVerification: {
        update: jest.fn().mockResolvedValue({
          id: 'kyc-1',
          userId: 'u1',
          status: KycStatus.FAILED,
          identityLast4: '8901',
          identityType: IdentityType.BVN,
          identityVerificationStatus: IdentityVerificationStatus.MANUAL_REVIEW,
          identityProviderReference: null,
          identityVerifiedAt: null,
          failureReason: 'bad docs',
          requiresReview: true,
          reviewedById: 'adm1',
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      },
      user: { update: jest.fn() },
      kycAuditLog: { create: jest.fn() },
      adminActivityLog: { create: jest.fn() },
    };
    prismaMock.$transaction.mockImplementation(async (cb: any) => cb(txCtx));

    await service.rejectKyc('adm1', 'u1', { failureReason: 'bad docs' });

    expect(txCtx.kycAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'KYC_REJECT',
          previousKycStatus: KycStatus.REQUIRES_REVIEW,
          nextKycStatus: KycStatus.FAILED,
          reason: 'bad docs',
        }),
      }),
    );
  });

  it('complete upload rejects key outside user prefix', async () => {
    await expect(
      service.completeKycUpload('u1', {
        docType: 'ID_FRONT',
        key: 'users/u2/kyc/id_front/hack.jpg',
        contentType: 'image/jpeg',
        sizeBytes: 100,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('complete upload rejects missing object', async () => {
    storageMock.headObject.mockRejectedValue(new Error('missing'));
    await expect(
      service.completeKycUpload('u1', {
        docType: 'ID_FRONT',
        key: 'users/u1/kyc/id_front/file.jpg',
        contentType: 'image/jpeg',
        sizeBytes: 100,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('complete upload rejects content-type mismatch and oversize', async () => {
    prismaMock.kycVerification.findUnique.mockResolvedValue({
      userId: 'u1',
      kycDocumentSlots: {
        ID_FRONT: {
          storageKey: 'users/u1/kyc/id_front/file.jpg',
          status: 'PENDING_PUT',
          expectedContentType: 'image/jpeg',
          expectedMaxBytes: 900,
          presignedIssuedAt: new Date().toISOString(),
        },
      },
    });

    storageMock.headObject.mockResolvedValue({
      contentLength: 950,
      contentType: 'application/pdf',
      etag: 'etag',
      lastModified: new Date(),
    });
    await expect(
      service.completeKycUpload('u1', {
        docType: 'ID_FRONT',
        key: 'users/u1/kyc/id_front/file.jpg',
        contentType: 'application/pdf',
        sizeBytes: 950,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    storageMock.headObject.mockResolvedValue({
      contentLength: 1200,
      contentType: 'image/jpeg',
      etag: 'etag',
      lastModified: new Date(),
    });
    await expect(
      service.completeKycUpload('u1', {
        docType: 'ID_FRONT',
        key: 'users/u1/kyc/id_front/file.jpg',
        contentType: 'image/jpeg',
        sizeBytes: 1200,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('sanitize response masks identity and never returns plaintext fields', () => {
    const output = service.sanitizeKycRecordForResponse({
      id: 'kyc-1',
      userId: 'u1',
      status: KycStatus.PENDING,
      identityLast4: '8901',
      identityVerificationStatus: IdentityVerificationStatus.MANUAL_REVIEW,
      identityType: IdentityType.BVN,
      identityProviderReference: 'provider-ref',
      identityVerifiedAt: null,
      failureReason: null,
      requiresReview: true,
      reviewedById: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(output.identityMasked).toBe('****8901');
    expect((output as any).governmentIdNumber).toBeUndefined();
  });
});
