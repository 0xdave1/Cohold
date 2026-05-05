import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { WsAuthTokenVerifier } from './ws-auth-token.verifier';
import { PrismaService } from '../../prisma/prisma.service';

const USER_SECRET = 'user-access-secret-32chars-minimum';
const ADMIN_SECRET = 'admin-access-secret-32chars-minimum';
const ISS = 'cohold-api';
const AUD_USER = 'cohold-client';
const AUD_ADMIN = 'cohold-admin-panel';

describe('WsAuthTokenVerifier', () => {
  let verifier: WsAuthTokenVerifier;
  let jwt: JwtService;
  /** Per-call secrets (matches production); avoid JwtModule default secret skewing admin/user tokens. */
  const jwtFactory = () => new JwtService({});
  const prismaMock = {
    user: { findUnique: jest.fn() },
    admin: { findUnique: jest.fn() },
    adminSession: { findFirst: jest.fn() },
  };

  const configGet = jest.fn((k: string) => {
    const m: Record<string, string> = {
      'config.jwt.accessSecret': USER_SECRET,
      'config.jwt.issuer': ISS,
      'config.jwt.audience': AUD_USER,
      'config.jwt.adminAccessSecret': ADMIN_SECRET,
      'config.jwt.adminIssuer': ISS,
      'config.jwt.adminAudience': AUD_ADMIN,
    };
    return m[k];
  });
  const configService = { get: configGet } as unknown as ConfigService;

  beforeEach(async () => {
    jest.resetAllMocks();
    configGet.mockImplementation((k: string) => {
      const m: Record<string, string> = {
        'config.jwt.accessSecret': USER_SECRET,
        'config.jwt.issuer': ISS,
        'config.jwt.audience': AUD_USER,
        'config.jwt.adminAccessSecret': ADMIN_SECRET,
        'config.jwt.adminIssuer': ISS,
        'config.jwt.adminAudience': AUD_ADMIN,
      };
      return m[k];
    });
    const moduleRef = await Test.createTestingModule({
      providers: [
        WsAuthTokenVerifier,
        { provide: JwtService, useFactory: jwtFactory },
        { provide: ConfigService, useValue: configService },
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    verifier = moduleRef.get(WsAuthTokenVerifier);
    jwt = moduleRef.get(JwtService);
  });

  async function signUserAccess(overrides: Record<string, unknown> = {}) {
    return jwt.signAsync(
      { sub: 'u1', role: 'user', tokenType: 'user_access', ...overrides },
      { secret: USER_SECRET, issuer: ISS, audience: AUD_USER, algorithm: 'HS256' },
    );
  }

  async function signAdminAccess(overrides: Record<string, unknown> = {}) {
    return jwt.signAsync(
      {
        sub: 'adm1',
        role: 'SUPER_ADMIN',
        email: 'a@x.co',
        sessionId: 'sess1',
        tokenType: 'admin_access',
        ...overrides,
      },
      { secret: ADMIN_SECRET, issuer: ISS, audience: AUD_ADMIN, algorithm: 'HS256' },
    );
  }

  it('verifyUserAccessSocket rejects admin_access token', async () => {
    const token = await signAdminAccess();
    expect(await verifier.verifyUserAccessSocket(token)).toBeNull();
  });

  it('verifyAdminAccessSocket rejects user_access token', async () => {
    const token = await signUserAccess();
    expect(await verifier.verifyAdminAccessSocket(token)).toBeNull();
  });

  it('verifyUserAccessSocket rejects wrong issuer', async () => {
    const token = await jwt.signAsync(
      { sub: 'u1', role: 'user', tokenType: 'user_access' },
      { secret: USER_SECRET, issuer: 'evil', audience: AUD_USER, algorithm: 'HS256' },
    );
    expect(await verifier.verifyUserAccessSocket(token)).toBeNull();
  });

  it('verifyUserAccessSocket rejects wrong audience', async () => {
    const token = await jwt.signAsync(
      { sub: 'u1', role: 'user', tokenType: 'user_access' },
      { secret: USER_SECRET, issuer: ISS, audience: 'wrong', algorithm: 'HS256' },
    );
    expect(await verifier.verifyUserAccessSocket(token)).toBeNull();
  });

  it('verifySupportAccessSocket rejects user_refresh token shape', async () => {
    const token = await jwt.signAsync(
      { sub: 'u1', role: 'user', tokenType: 'user_refresh', sid: 's', jti: 'j' },
      { secret: USER_SECRET, issuer: ISS, audience: AUD_USER, algorithm: 'HS256' },
    );
    expect(await verifier.verifySupportAccessSocket(token)).toBeNull();
  });

  it('verifyAdminAccessSocket rejects revoked session', async () => {
    prismaMock.adminSession.findFirst.mockResolvedValue(null);
    const token = await signAdminAccess();
    expect(await verifier.verifyAdminAccessSocket(token)).toBeNull();
  });

  it('verifyAdminAccessSocket rejects suspended admin', async () => {
    prismaMock.adminSession.findFirst.mockResolvedValue({ id: 'sess1' });
    prismaMock.admin.findUnique.mockResolvedValue({
      accountStatus: 'SUSPENDED',
      email: 'a@x.co',
      role: 'SUPER_ADMIN',
    });
    const token = await signAdminAccess();
    expect(await verifier.verifyAdminAccessSocket(token)).toBeNull();
  });

  it('verifyAdminAccessSocket rejects inactive admin', async () => {
    prismaMock.adminSession.findFirst.mockResolvedValue({ id: 'sess1' });
    prismaMock.admin.findUnique.mockResolvedValue({
      accountStatus: 'INACTIVE',
      email: 'a@x.co',
      role: 'SUPER_ADMIN',
    });
    const token = await signAdminAccess();
    expect(await verifier.verifyAdminAccessSocket(token)).toBeNull();
  });

  it('verifyUserAccessSocket accepts valid user', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      emailVerifiedAt: new Date(),
      isFrozen: false,
    });
    const token = await signUserAccess();
    expect(await verifier.verifyUserAccessSocket(token)).toBe('u1');
  });

  it('verifyAdminAccessSocket accepts active admin with session', async () => {
    prismaMock.adminSession.findFirst.mockResolvedValue({ id: 'sess1' });
    prismaMock.admin.findUnique.mockResolvedValue({
      accountStatus: 'ACTIVE',
      email: 'a@x.co',
      role: 'SUPER_ADMIN',
    });
    const token = await signAdminAccess();
    expect(await verifier.verifyAdminAccessSocket(token)).toBe('adm1');
  });

  it('verifySupportAccessSocket accepts support admin', async () => {
    prismaMock.adminSession.findFirst.mockResolvedValue({ id: 'sess1' });
    prismaMock.admin.findUnique.mockResolvedValue({
      accountStatus: 'ACTIVE',
      email: 'a@x.co',
      role: 'SUPER_ADMIN',
      canSupport: false,
    });
    const token = await signAdminAccess();
    const r = await verifier.verifySupportAccessSocket(token);
    expect(r).toEqual({ kind: 'admin', adminId: 'adm1', canSupport: true });
  });
});
