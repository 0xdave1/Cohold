import * as fs from 'fs';
import * as path from 'path';
import { AdminRole } from '@prisma/client';
import { AdminService } from './admin.service';
import { AdminRbacMatrix } from './admin-rbac.matrix';

describe('Issue 11 admin operational control center', () => {
  it('admin controller uses strict role matrix for high-risk routes', () => {
    const src = fs.readFileSync(path.join(__dirname, 'admin.controller.ts'), 'utf8');
    expect(src).toContain('@UseGuards(AdminJwtGuard, AdminRoleGuard, RolesGuard)');
    expect(src).toContain("@Post('users/:id/freeze')");
    expect(src).toContain("@Post('users/:id/unfreeze')");
    expect(src).toContain('@Roles(...AdminRbacMatrix.withdrawals.reconcile)');
  });

  it('SUPER_ADMIN-only routes: user disable, stale batch reconcile, admin management', () => {
    const src = fs.readFileSync(path.join(__dirname, 'admin.controller.ts'), 'utf8');
    expect(src).toMatch(/@Roles\(AdminRole\.SUPER_ADMIN\)[\s\S]*?@Delete\('users\/:id'\)/);
    expect(src).toMatch(/@Roles\(AdminRole\.SUPER_ADMIN\)[\s\S]*?@Post\('withdrawals\/reconcile-stale'\)/);
    expect(src).toContain('@Roles(...AdminRbacMatrix.adminManagement.mutate)');
    expect(src).toContain("@Post('admins')");
    expect(src).toContain("@Post('admins/:id/suspend')");
  });

  it('admin RBAC matrix keeps admin management mutations SUPER_ADMIN only', () => {
    expect(AdminRbacMatrix.adminManagement.mutate).toEqual([AdminRole.SUPER_ADMIN]);
  });

  it('publishProperty audit metadata does not claim legal or title verification', () => {
    const src = fs.readFileSync(path.join(__dirname, 'admin.service.ts'), 'utf8');
    const start = src.indexOf('async publishProperty(');
    const end = src.indexOf('async unpublishProperty(', start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const block = src.slice(start, end);
    expect(block).toContain('publishGate');
    expect(block).not.toMatch(/legalVerified|titleVerified|legal_verified/i);
  });

  it('dashboard overview does not hardcode fake zero disputes/revenue', () => {
    const src = fs.readFileSync(path.join(__dirname, 'admin.service.ts'), 'utf8');
    expect(src).not.toContain('openDisputes: 0');
    expect(src).not.toContain("coholdRevenue: '0'");
    expect(src).toContain('unsupported');
  });

  it('freeze/unfreeze require reason and list endpoints cap limit', async () => {
    const prisma = {
      user: {
        update: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      admin: {
        findUnique: jest.fn().mockResolvedValue({ role: 'SUPER_ADMIN' }),
      },
      adminActivityLog: {
        create: jest.fn().mockResolvedValue({}),
      },
    } as any;
    const service = new AdminService(
      prisma,
      {} as any,
      {} as any,
      { buildReport: jest.fn() } as any,
      { sanitizeKycRecordForResponse: jest.fn() } as any,
      {} as any,
    );

    await expect(service.freezeUser('u1', 'a1', '   ')).rejects.toThrow('Reason is required');
    await expect(service.unfreezeUser('u1', 'a1', 'no')).rejects.toThrow('at least 5');

    await service.listUsers({ page: 1, limit: 999, kycStatus: undefined });
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 }),
    );
  });
});
