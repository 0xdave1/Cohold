'use client';

import type { AdminUser } from '@/lib/admin/types';
import {
  ROLE_BADGE,
  ROLE_LABEL,
  STATUS_BADGE,
  STATUS_LABEL,
  displayAdminId,
  displayAdminName,
  formatDateTime,
  normalizeRole,
  normalizeStatus,
} from './constants';

type AdminDetailCardProps = {
  admin: AdminUser;
  onSuspend: () => void;
};

export function AdminDetailCard({ admin, onSuspend }: AdminDetailCardProps) {
  const role = normalizeRole(admin.role);
  const status = normalizeStatus(admin.status);
  const name = displayAdminName(admin);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x.charAt(0).toUpperCase())
    .join('');

  return (
    <div className="rounded-2xl border border-[#E8E4DC] bg-white p-6 shadow-sm">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#E5E7EB] text-lg font-semibold text-[#374151]">
            {initials || 'AD'}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#111827]">{name}</h2>
            <p className="text-sm font-medium text-[#2563EB]">{admin.email}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onSuspend}
          className="shrink-0 rounded-full bg-[#DC2626] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#B91C1C]"
        >
          Suspend admin
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[#9CA3AF]">Admin ID</p>
          <p className="mt-1 text-sm font-semibold text-[#111827]">{displayAdminId(admin)}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[#9CA3AF]">User name</p>
          <p className="mt-1 text-sm font-semibold text-[#111827]">{name}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[#9CA3AF]">Email</p>
          <p className="mt-1 text-sm font-medium text-[#2563EB]">{admin.email}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[#9CA3AF]">Role</p>
          <p className="mt-2">
            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${ROLE_BADGE[role]}`}>
              {ROLE_LABEL[role]}
            </span>
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[#9CA3AF]">Status</p>
          <p className="mt-2">
            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_BADGE[status]}`}>
              {STATUS_LABEL[status]}
            </span>
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[#9CA3AF]">Last logged in</p>
          <p className="mt-1 text-sm font-medium tabular-nums text-[#111827]">
            {formatDateTime(admin.lastLoggedInAt ?? admin.lastLoginAt)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[#9CA3AF]">Phone number</p>
          <p className="mt-1 text-sm font-medium text-[#111827]">{admin.phoneNumber?.trim() || '—'}</p>
        </div>
      </div>
    </div>
  );
}
