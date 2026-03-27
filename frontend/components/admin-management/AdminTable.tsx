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
import { AdminActionMenu } from './AdminActionMenu';
import { AdminPagination } from './AdminPagination';

type AdminTableProps = {
  data: AdminUser[];
  loading: boolean;
  page: number;
  totalPages: number;
  selectedIds: string[];
  menuOpenId: string | null;
  error?: string | null;
  onToggleAll: (checked: boolean) => void;
  onToggleOne: (id: string, checked: boolean) => void;
  onMenuToggle: (id: string) => void;
  onMenuClose: () => void;
  onView: (admin: AdminUser) => void;
  onEdit: (admin: AdminUser) => void;
  onSuspend: (admin: AdminUser) => void;
  onDeactivate: (admin: AdminUser) => void;
  onPageChange: (page: number) => void;
};

export function AdminTable({
  data,
  loading,
  page,
  totalPages,
  selectedIds,
  menuOpenId,
  error,
  onToggleAll,
  onToggleOne,
  onMenuToggle,
  onMenuClose,
  onView,
  onEdit,
  onSuspend,
  onDeactivate,
  onPageChange,
}: AdminTableProps) {
  const allSelected = data.length > 0 && data.every((i) => selectedIds.includes(i.id));

  return (
    <div className="overflow-hidden rounded-xl border border-[#E8E4DC] bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-[#E8E4DC] bg-[#FAFAF8]">
              <th className="w-10 px-4 py-3.5 text-left">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-[#D1D5DB] text-[#1a3a4a] focus:ring-[#1a3a4a]"
                  checked={allSelected}
                  onChange={(e) => onToggleAll(e.target.checked)}
                  aria-label="Select all"
                />
              </th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                ID
              </th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                Admin
              </th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                Role
              </th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                Last logged in
              </th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                Status
              </th>
              <th className="w-14 px-4 py-3.5" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-[#F3F4F6]">
                  {Array.from({ length: 7 }).map((__, j) => (
                    <td key={j} className="px-4 py-4">
                      <div className="h-4 w-24 animate-pulse rounded bg-[#F3F4F6]" />
                    </td>
                  ))}
                </tr>
              ))
            ) : error ? (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center">
                  <div className="mx-auto max-w-md rounded-xl border border-red-200 bg-red-50 px-4 py-6 text-sm text-red-800">
                    <p className="font-medium">Couldn&apos;t load admins</p>
                    <p className="mt-1 text-red-700/90">{error}</p>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center text-sm text-[#6B7280]">
                  No admins match your filters. Try adjusting search or filters.
                </td>
              </tr>
            ) : (
              data.map((admin) => {
                const role = normalizeRole(admin.role);
                const status = normalizeStatus(admin.status);
                const lastSeen = admin.lastLoggedInAt ?? admin.lastLoginAt;
                return (
                  <tr key={admin.id} className="border-b border-[#F3F4F6] transition hover:bg-[#FFFCF8]">
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-[#D1D5DB] text-[#1a3a4a] focus:ring-[#1a3a4a]"
                        checked={selectedIds.includes(admin.id)}
                        onChange={(e) => onToggleOne(admin.id, e.target.checked)}
                        aria-label={`Select ${displayAdminName(admin)}`}
                      />
                    </td>
                    <td className="px-4 py-4 font-medium text-[#111827]">{displayAdminId(admin)}</td>
                    <td className="px-4 py-4">
                      <p className="font-semibold text-[#111827]">{displayAdminName(admin)}</p>
                      <p className="text-xs font-medium text-[#2563EB]">{admin.email}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${ROLE_BADGE[role]}`}
                      >
                        {ROLE_LABEL[role]}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-xs tabular-nums text-[#4B5563]">{formatDateTime(lastSeen)}</td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_BADGE[status]}`}
                      >
                        {STATUS_LABEL[status]}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <AdminActionMenu
                        open={menuOpenId === admin.id}
                        onToggle={() => onMenuToggle(admin.id)}
                        onClose={onMenuClose}
                        onView={() => onView(admin)}
                        onEdit={() => onEdit(admin)}
                        onSuspend={() => onSuspend(admin)}
                        onDeactivate={() => onDeactivate(admin)}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <AdminPagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
    </div>
  );
}
