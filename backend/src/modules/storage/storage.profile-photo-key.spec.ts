import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';

describe('StorageService generateProfilePhotoKey (Issue 12)', () => {
  it('returns user-scoped profile prefix with random file name (not client-supplied path)', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        StorageService,
        {
          provide: ConfigService,
          useValue: {
            get: () => undefined,
          },
        },
      ],
    }).compile();
    const storage = moduleRef.get(StorageService);
    const key = storage.generateProfilePhotoKey('user-123', 'png');
    expect(key.startsWith('users/user-123/profile/')).toBe(true);
    expect(key.endsWith('.png')).toBe(true);
    expect(key).not.toContain('..');
  });
});
