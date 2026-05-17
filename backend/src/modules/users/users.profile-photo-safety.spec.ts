import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BadRequestException } from '@nestjs/common';
import { assertValidUpload } from '../storage/upload-validation';
import { UsersService } from './users.service';

describe('Profile photo presign / complete safety (Issue 12)', () => {
  describe('assertValidUpload(profilePhoto)', () => {
    it('rejects unsupported content types', () => {
      expect(() =>
        assertValidUpload({
          category: 'profilePhoto',
          contentType: 'image/gif',
          fileSize: 1000,
          fileName: 'a.gif',
        }),
      ).toThrow(BadRequestException);
    });

    it('rejects oversize files', () => {
      expect(() =>
        assertValidUpload({
          category: 'profilePhoto',
          contentType: 'image/jpeg',
          fileSize: 4 * 1024 * 1024,
          fileName: 'a.jpg',
        }),
      ).toThrow(BadRequestException);
    });

    it('accepts allowed image types within limit', () => {
      expect(() =>
        assertValidUpload({
          category: 'profilePhoto',
          contentType: 'image/png',
          fileSize: 1024,
          fileName: 'a.png',
        }),
      ).not.toThrow();
    });
  });

  describe('UsersService.setProfilePhotoKey', () => {
    const prisma = {
      user: { update: jest.fn(), findUnique: jest.fn() },
    } as any;
    const storage = {
      createSignedReadUrl: jest.fn().mockResolvedValue('https://signed.example/read'),
    } as any;
    const payoutProvider = {} as any;
    const kycService = { reconcileUserKycSnapshotIfDrifted: jest.fn().mockResolvedValue('PENDING') } as any;
    let service: UsersService;

    beforeEach(() => {
      jest.clearAllMocks();
      service = new UsersService(prisma, storage, payoutProvider, kycService);
      storage.createSignedReadUrl.mockResolvedValue('https://signed.example/read');
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        emailVerifiedAt: null,
        username: null,
        firstName: 'A',
        lastName: 'B',
        phoneNumber: null,
        phoneCountryCode: null,
        nationality: null,
        houseNumber: null,
        streetName: null,
        city: null,
        state: null,
        kycStatus: 'PENDING',
        onboardingCompletedAt: null,
        profilePhotoKey: 'users/u1/profile/x.jpg',
        profileImageUrl: null,
        createdAt: new Date(),
      });
    });

    it('rejects client-controlled key prefix (wrong user path)', async () => {
      await expect(service.setProfilePhotoKey('u1', 'users/evil/profile/x.jpg')).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('rejects key outside profile namespace', async () => {
      await expect(service.setProfilePhotoKey('u1', 'users/u1/kyc/doc.pdf')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('accepts server-shaped profile key and updates only that user', async () => {
      const key = 'users/u1/profile/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jpg';
      await service.setProfilePhotoKey('u1', key);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: expect.objectContaining({
          profilePhotoKey: key,
        }),
      });
      expect(storage.createSignedReadUrl).toHaveBeenCalledWith(key, 300);
    });
  });

  describe('clearProfilePhoto', () => {
    it('clears avatar only for the given user id', async () => {
      const prisma = {
        user: {
          update: jest.fn().mockResolvedValue({}),
          findUnique: jest.fn().mockResolvedValue({
            id: 'u9',
            email: 'x@y.com',
            emailVerifiedAt: null,
            username: null,
            firstName: null,
            lastName: null,
            phoneNumber: null,
            phoneCountryCode: null,
            nationality: null,
            houseNumber: null,
            streetName: null,
            city: null,
            state: null,
            kycStatus: 'PENDING',
            onboardingCompletedAt: null,
            profilePhotoKey: null,
            profileImageUrl: null,
            createdAt: new Date(),
          }),
        },
      } as any;
      const storage = { createSignedReadUrl: jest.fn() } as any;
      const kyc = { reconcileUserKycSnapshotIfDrifted: jest.fn().mockResolvedValue('PENDING') } as any;
      const service = new UsersService(prisma, storage, {} as any, kyc);
      await service.clearProfilePhoto('u9');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u9' },
        data: { profilePhotoKey: null, profileImageUrl: null },
      });
    });
  });

  describe('UsersController presign contract', () => {
    it('generates key server-side and returns only key, uploadUrl, expiresIn (no provider secrets)', () => {
      const src = readFileSync(join(__dirname, 'users.controller.ts'), 'utf8');
      expect(src).toContain('generateProfilePhotoKey(user.id');
      expect(src).toContain('return { key, uploadUrl, expiresIn: 900 }');
      expect(src).not.toContain('secretAccessKey');
    });
  });
});
