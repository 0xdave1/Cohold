import { AdminRole } from '@prisma/client';

/**
 * Issue 11 RBAC matrix for admin operational domains.
 * Keep controller `@Roles` aligned with these constants.
 */
export const AdminRbacMatrix = {
  users: {
    read: [AdminRole.DATA_UPLOADER, AdminRole.APPROVER, AdminRole.COMPLIANCE_ADMIN, AdminRole.SUPER_ADMIN],
    freeze: [AdminRole.COMPLIANCE_ADMIN, AdminRole.SUPER_ADMIN],
    unfreeze: [AdminRole.COMPLIANCE_ADMIN, AdminRole.SUPER_ADMIN],
  },
  kyc: {
    review: [AdminRole.APPROVER, AdminRole.COMPLIANCE_ADMIN, AdminRole.SUPER_ADMIN],
  },
  withdrawals: {
    read: [AdminRole.DATA_UPLOADER, AdminRole.APPROVER, AdminRole.COMPLIANCE_ADMIN, AdminRole.SUPER_ADMIN],
    reconcile: [AdminRole.APPROVER, AdminRole.SUPER_ADMIN],
  },
  virtualAccounts: {
    read: [AdminRole.APPROVER, AdminRole.COMPLIANCE_ADMIN, AdminRole.SUPER_ADMIN],
    retry: [AdminRole.APPROVER, AdminRole.COMPLIANCE_ADMIN, AdminRole.SUPER_ADMIN],
  },
  ledger: {
    readOnly: [AdminRole.SUPER_ADMIN],
  },
  properties: {
    read: [AdminRole.DATA_UPLOADER, AdminRole.APPROVER, AdminRole.COMPLIANCE_ADMIN, AdminRole.SUPER_ADMIN],
    publish: [AdminRole.APPROVER, AdminRole.COMPLIANCE_ADMIN, AdminRole.SUPER_ADMIN],
    unpublish: [AdminRole.APPROVER, AdminRole.COMPLIANCE_ADMIN, AdminRole.SUPER_ADMIN],
  },
  support: {
    operations: [AdminRole.DATA_UPLOADER, AdminRole.APPROVER, AdminRole.COMPLIANCE_ADMIN, AdminRole.SUPER_ADMIN],
  },
  ops: {
    outboxJobs: [AdminRole.COMPLIANCE_ADMIN, AdminRole.SUPER_ADMIN],
  },
  adminManagement: {
    mutate: [AdminRole.SUPER_ADMIN],
  },
} as const;
