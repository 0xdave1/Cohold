import 'reflect-metadata';
import { AdminRole } from '@prisma/client';
import { OpsController } from './ops.controller';

describe('OpsController security metadata', () => {
  it('requires admin guards and privileged roles', () => {
    const classRoles = Reflect.getMetadata('roles', OpsController) as AdminRole[];
    expect(classRoles).toContain(AdminRole.SUPER_ADMIN);
    expect(classRoles).toContain(AdminRole.COMPLIANCE_ADMIN);

    const guardMeta = Reflect.getMetadata('__guards__', OpsController) as unknown[];
    expect(Array.isArray(guardMeta)).toBe(true);
    expect(guardMeta.length).toBeGreaterThan(0);
  });
});
