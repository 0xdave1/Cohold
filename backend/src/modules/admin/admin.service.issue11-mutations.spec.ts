import { AdminAccountStatus, AdminRole, PropertyStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AdminService } from './admin.service';

function mkDeps(overrides: {
  prisma?: Record<string, unknown>;
  withdrawalService?: { reconcileStaleWithdrawals: jest.Mock };
} = {}) {
  const withdrawalService = overrides.withdrawalService ?? {
    reconcileStaleWithdrawals: jest.fn().mockResolvedValue({
      scanned: 1,
      results: [{ id: 'w1', ok: false, error: 'Bank account 12345678901234 rejected' }],
    }),
  };
  const prisma = overrides.prisma ?? {};
  return {
    service: new AdminService(
      prisma as any,
      {} as any,
      withdrawalService as any,
      { buildReport: jest.fn() } as any,
      { sanitizeKycRecordForResponse: jest.fn() } as any,
      {} as any,
    ),
    withdrawalService,
    prisma,
  };
}

describe('AdminService Issue 11 sensitive mutations', () => {
  beforeEach(() => {
    jest.spyOn(bcrypt, 'hash').mockResolvedValue('$2b$mockedhash' as never);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('deleteUser rejects short reason and writes USER_DISABLED audit in transaction', async () => {
    const logCreate = jest.fn().mockResolvedValue({});
    const tx = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'u1', isFrozen: false, email: 'u@test.com' }),
        update: jest.fn().mockResolvedValue({}),
      },
      admin: { findUnique: jest.fn().mockResolvedValue({ role: AdminRole.SUPER_ADMIN }) },
      adminActivityLog: { create: logCreate },
    };
    const prisma = {
      $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<void>) => fn(tx)),
    };
    const { service } = mkDeps({ prisma });

    await expect(service.deleteUser('u1', 'a1', 'nope', {})).rejects.toThrow(/5/);
    await service.deleteUser('u1', 'a1', 'Disabling per fraud investigation.', {
      ipAddress: '10.0.0.1',
      userAgent: 'jest',
    });
    expect(tx.user.update).toHaveBeenCalled();
    expect(logCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'USER_DISABLED',
          reason: 'Disabling per fraud investigation.',
          ipAddress: '10.0.0.1',
          userAgent: 'jest',
        }),
      }),
    );
    const meta = (logCreate.mock.calls[0][0] as { data: { metadata?: unknown } }).data.metadata as Record<
      string,
      unknown
    >;
    expect(meta).toBeDefined();
  });

  it('adminReconcileStaleWithdrawals requires reason and logs batch metadata with digit masking in errors', async () => {
    const logCreate = jest.fn().mockResolvedValue({});
    const tx = {
      admin: { findUnique: jest.fn().mockResolvedValue({ role: AdminRole.SUPER_ADMIN }) },
      adminActivityLog: { create: logCreate },
    };
    const prisma = { $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<void>) => fn(tx)) };
    const { service, withdrawalService } = mkDeps({ prisma });

    await expect(service.adminReconcileStaleWithdrawals('a1', 'x', 30, {})).rejects.toThrow(/5/);
    await service.adminReconcileStaleWithdrawals('a1', 'Batch reconcile after provider incident.', 30, {});
    expect(withdrawalService.reconcileStaleWithdrawals).toHaveBeenCalled();
    expect(logCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'RECONCILE_STALE_WITHDRAWALS',
          reason: 'Batch reconcile after provider incident.',
        }),
      }),
    );
    const persisted = (logCreate.mock.calls[0][0] as { data: { metadata?: unknown } }).data.metadata as {
      results?: { error?: string }[];
    };
    expect(JSON.stringify(persisted)).not.toMatch(/12345678901234/);
  });

  it('closeProperty writes CLOSE_PROPERTY audit', async () => {
    const logCreate = jest.fn().mockResolvedValue({});
    const tx = {
      property: {
        findFirst: jest.fn().mockResolvedValue({ id: 'p1', status: PropertyStatus.PUBLISHED }),
        update: jest.fn().mockResolvedValue({}),
      },
      admin: { findUnique: jest.fn().mockResolvedValue({ role: AdminRole.SUPER_ADMIN }) },
      adminActivityLog: { create: logCreate },
    };
    const prisma = { $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<void>) => fn(tx)) };
    const { service } = mkDeps({ prisma });
    await service.closeProperty('p1', 'a1', 'End of offering per sponsor.', {});
    expect(logCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'CLOSE_PROPERTY',
          reason: 'End of offering per sponsor.',
        }),
      }),
    );
  });

  it('softDeleteProperty writes DELETE_PROPERTY audit', async () => {
    const logCreate = jest.fn().mockResolvedValue({});
    const tx = {
      property: {
        findFirst: jest.fn().mockResolvedValue({ id: 'p1', status: PropertyStatus.DRAFT }),
        update: jest.fn().mockResolvedValue({}),
      },
      admin: { findUnique: jest.fn().mockResolvedValue({ role: AdminRole.SUPER_ADMIN }) },
      adminActivityLog: { create: logCreate },
    };
    const prisma = { $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<void>) => fn(tx)) };
    const { service } = mkDeps({ prisma });
    await service.softDeleteProperty('p1', 'a1', 'Remove mistaken duplicate listing.', {});
    expect(logCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'DELETE_PROPERTY',
        }),
      }),
    );
  });

  it('suspendAdmin writes audit for non-super target without super coverage count', async () => {
    const logCreate = jest.fn().mockResolvedValue({});
    const tx = {
      admin: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 't1',
          role: AdminRole.DATA_UPLOADER,
          accountStatus: AdminAccountStatus.ACTIVE,
        }),
        update: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue({ role: AdminRole.SUPER_ADMIN }),
        count: jest.fn(),
      },
      adminActivityLog: { create: logCreate },
    };
    const prisma = { $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<void>) => fn(tx)) };
    const { service } = mkDeps({ prisma });
    await service.suspendAdmin('t1', 'actor1', 'Suspension pending HR review.', {});
    expect(tx.admin.count).not.toHaveBeenCalled();
    expect(logCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'ADMIN_SUSPENDED',
          reason: 'Suspension pending HR review.',
        }),
      }),
    );
  });

  it('createAdmin writes ADMIN_CREATED audit (no password in log payload)', async () => {
    const logCreate = jest.fn().mockResolvedValue({});
    const createdRow = {
      id: 'newadm',
      email: 'new@cohold.test',
      fullName: 'New Admin',
      phoneNumber: null,
      role: AdminRole.DATA_UPLOADER,
      lastLoginAt: null,
      createdAt: new Date(),
      accountStatus: AdminAccountStatus.ACTIVE,
    };
    const tx = {
      admin: {
        create: jest.fn().mockResolvedValue(createdRow),
        findUnique: jest.fn().mockResolvedValue({ role: AdminRole.SUPER_ADMIN }),
      },
      adminActivityLog: { create: logCreate },
    };
    const prisma = {
      admin: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<typeof createdRow>) => fn(tx)),
    };
    const { service } = mkDeps({ prisma });
    const out = await service.createAdmin(
      'actor1',
      {
        email: 'new@cohold.test',
        fullName: 'New Admin',
        role: 'OPERATION_ADMIN',
        reason: 'Onboarding ops teammate for listings.',
      },
      {},
    );
    expect(out.tempPassword).toBeDefined();
    expect(logCreate).toHaveBeenCalled();
    const payload = JSON.stringify(logCreate.mock.calls[0][0]);
    expect(payload).not.toMatch(/tempPassword|Admin-/i);
  });
});
