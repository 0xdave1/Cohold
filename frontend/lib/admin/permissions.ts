/** Prisma `AdminRole` values carried in admin JWT `role`. */
export type AdminDbRole = 'DATA_UPLOADER' | 'APPROVER' | 'COMPLIANCE_ADMIN' | 'SUPER_ADMIN';

export function parseAdminRole(role: string | null | undefined): AdminDbRole | null {
  if (!role) return null;
  const r = role.trim().toUpperCase();
  if (r === 'DATA_UPLOADER' || r === 'APPROVER' || r === 'COMPLIANCE_ADMIN' || r === 'SUPER_ADMIN') {
    return r;
  }
  return null;
}

function has(role: AdminDbRole | null, ...allowed: AdminDbRole[]): boolean {
  if (!role) return false;
  return allowed.includes(role);
}

export function canViewUsers(role: AdminDbRole | null): boolean {
  return has(role, 'DATA_UPLOADER', 'APPROVER', 'COMPLIANCE_ADMIN', 'SUPER_ADMIN');
}

export function canViewKyc(role: AdminDbRole | null): boolean {
  return has(role, 'DATA_UPLOADER', 'APPROVER', 'COMPLIANCE_ADMIN', 'SUPER_ADMIN');
}

export function canReviewKyc(role: AdminDbRole | null): boolean {
  return has(role, 'APPROVER', 'COMPLIANCE_ADMIN', 'SUPER_ADMIN');
}

export function canViewFinance(role: AdminDbRole | null): boolean {
  return has(role, 'DATA_UPLOADER', 'APPROVER', 'COMPLIANCE_ADMIN', 'SUPER_ADMIN');
}

export function canReconcileWithdrawal(role: AdminDbRole | null): boolean {
  return has(role, 'APPROVER', 'SUPER_ADMIN');
}

/** Batch stale withdrawal reconcile — backend `POST admin/withdrawals/reconcile-stale` is SUPER_ADMIN only. */
export function canReconcileStaleWithdrawalsBatch(role: AdminDbRole | null): boolean {
  return has(role, 'SUPER_ADMIN');
}

export function canRetryVirtualAccount(role: AdminDbRole | null): boolean {
  return has(role, 'APPROVER', 'COMPLIANCE_ADMIN', 'SUPER_ADMIN');
}

export function canProcessDistribution(role: AdminDbRole | null): boolean {
  return has(role, 'APPROVER', 'COMPLIANCE_ADMIN', 'SUPER_ADMIN');
}

export function canCreateIncomeEvent(role: AdminDbRole | null): boolean {
  return has(role, 'DATA_UPLOADER', 'APPROVER', 'COMPLIANCE_ADMIN', 'SUPER_ADMIN');
}

export function canManageProperties(role: AdminDbRole | null): boolean {
  return has(role, 'DATA_UPLOADER', 'APPROVER', 'COMPLIANCE_ADMIN', 'SUPER_ADMIN');
}

export function canPublishProperty(role: AdminDbRole | null): boolean {
  return has(role, 'APPROVER', 'COMPLIANCE_ADMIN', 'SUPER_ADMIN');
}

export function canManageSupport(role: AdminDbRole | null): boolean {
  return has(role, 'DATA_UPLOADER', 'APPROVER', 'COMPLIANCE_ADMIN', 'SUPER_ADMIN');
}

export function canViewOps(role: AdminDbRole | null): boolean {
  return has(role, 'COMPLIANCE_ADMIN', 'SUPER_ADMIN');
}

export function canViewLedgerReconciliation(role: AdminDbRole | null): boolean {
  return has(role, 'SUPER_ADMIN');
}

export function canManageAdmins(role: AdminDbRole | null): boolean {
  return has(role, 'SUPER_ADMIN');
}

export function canSuspendAdmin(role: AdminDbRole | null): boolean {
  return has(role, 'APPROVER', 'COMPLIANCE_ADMIN', 'SUPER_ADMIN');
}

export function canFreezeUser(role: AdminDbRole | null): boolean {
  return has(role, 'COMPLIANCE_ADMIN', 'SUPER_ADMIN');
}

/** Failed VA list, unmatched deposits, ops summary VA slice — not `DATA_UPLOADER`. */
export function canViewVirtualAccountOps(role: AdminDbRole | null): boolean {
  return has(role, 'APPROVER', 'COMPLIANCE_ADMIN', 'SUPER_ADMIN');
}

/** Close / delete property — matches admin controller `@Roles` for those mutations. */
export function canCloseProperty(role: AdminDbRole | null): boolean {
  return has(role, 'APPROVER', 'COMPLIANCE_ADMIN', 'SUPER_ADMIN');
}

export function canDeleteProperty(role: AdminDbRole | null): boolean {
  return has(role, 'APPROVER', 'COMPLIANCE_ADMIN', 'SUPER_ADMIN');
}
