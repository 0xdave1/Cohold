import type { AdminUser } from '@/lib/admin/types';

export type UiAdminRole = 'SUPER_ADMIN' | 'FINANCE_ADMIN' | 'OPERATION_ADMIN' | 'COMPLIANCE_ADMIN';
export type UiAdminStatus = 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
export type UiPeriod = 'today' | '7d' | '30d' | '180d';

export const ROLE_OPTIONS: Array<{ value: UiAdminRole; label: string }> = [
  { value: 'SUPER_ADMIN', label: 'Super admin' },
  { value: 'FINANCE_ADMIN', label: 'Finance admin' },
  { value: 'OPERATION_ADMIN', label: 'Operation admin' },
  { value: 'COMPLIANCE_ADMIN', label: 'Compliance admin' },
];

export const STATUS_OPTIONS: Array<{ value: UiAdminStatus; label: string }> = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'INACTIVE', label: 'Inactive' },
];

export const PERIOD_OPTIONS: Array<{ value: UiPeriod; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '180d', label: 'Last 180 days' },
];

/** Human-readable labels (sentence case) for Figma parity */
export const ROLE_LABEL: Record<UiAdminRole, string> = {
  SUPER_ADMIN: 'Super admin',
  FINANCE_ADMIN: 'Finance admin',
  OPERATION_ADMIN: 'Operation admin',
  COMPLIANCE_ADMIN: 'Compliance admin',
};

export const ROLE_BADGE: Record<UiAdminRole, string> = {
  SUPER_ADMIN: 'bg-[#EEF2FF] text-[#4338CA]',
  FINANCE_ADMIN: 'bg-[#F5F3FF] text-[#6D28D9]',
  OPERATION_ADMIN: 'bg-[#EFF6FF] text-[#1D4ED8]',
  COMPLIANCE_ADMIN: 'bg-[#ECFEFF] text-[#0E7490]',
};

export const STATUS_LABEL: Record<UiAdminStatus, string> = {
  ACTIVE: 'Active',
  SUSPENDED: 'Suspended',
  INACTIVE: 'Inactive',
};

export const STATUS_BADGE: Record<UiAdminStatus, string> = {
  ACTIVE: 'bg-[#ECFDF3] text-[#027A48]',
  SUSPENDED: 'bg-[#FFF7ED] text-[#C2410C]',
  INACTIVE: 'bg-[#FEF2F2] text-[#B91C1C]',
};

export function normalizeRole(role: AdminUser['role']): UiAdminRole {
  if (role === 'SUPER_ADMIN') return 'SUPER_ADMIN';
  if (role === 'FINANCE_ADMIN' || role === 'APPROVER') return 'FINANCE_ADMIN';
  if (role === 'COMPLIANCE_ADMIN') return 'COMPLIANCE_ADMIN';
  return 'OPERATION_ADMIN';
}

export function normalizeStatus(status: AdminUser['status'] | undefined): UiAdminStatus {
  if (status === 'SUSPENDED' || status === 'INACTIVE') return status;
  return 'ACTIVE';
}

export function displayAdminId(admin: AdminUser): string {
  return admin.adminId ?? `#${admin.id.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
}

export function displayAdminName(admin: AdminUser): string {
  if (admin.fullName?.trim()) return admin.fullName.trim();
  const local = admin.email.split('@')[0] ?? '';
  const cleaned = local.replace(/[._-]+/g, ' ').trim();
  if (!cleaned) return 'Admin User';
  return cleaned
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return 'Never';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '—';
  const date = dt.toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: '2-digit',
  });
  const time = dt.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${date}; ${time}`;
}
