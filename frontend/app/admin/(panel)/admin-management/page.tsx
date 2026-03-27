'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminToolbar } from '@/components/admin-management/AdminToolbar';
import { AdminTable } from '@/components/admin-management/AdminTable';
import type { UiPeriod } from '@/components/admin-management/constants';
import { AddAdminModal } from '@/components/admin-management/modals/AddAdminModal';
import { EditAdminModal } from '@/components/admin-management/modals/EditAdminModal';
import { SuspendAdminModal } from '@/components/admin-management/modals/SuspendAdminModal';
import { DeactivateAdminModal } from '@/components/admin-management/modals/DeactivateAdminModal';
import { adminApi } from '@/lib/admin/api';
import type { AdminUser } from '@/lib/admin/types';
import type { UiAdminRole } from '@/components/admin-management/constants';

const LIMIT = 10;

export default function AdminManagementPage() {
  const router = useRouter();
  const [items, setItems] = useState<AdminUser[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [period, setPeriod] = useState<UiPeriod>('30d');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeAdmin, setActiveAdmin] = useState<AdminUser | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchInput), 400);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
    if (role) params.set('role', role);
    if (status) params.set('status', status);
    if (period) params.set('period', period);

    adminApi
      .admins(params.toString())
      .then((d: { items?: AdminUser[]; meta?: { total?: number } }) => {
        if (!cancelled) {
          setItems(d.items ?? []);
          setTotal(d.meta?.total ?? 0);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setItems([]);
          setTotal(0);
          setError(e instanceof Error ? e.message : 'Failed to load admins');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [page, period, role, status, debouncedSearch]);

  const totalPages = Math.ceil(total / LIMIT) || 1;

  const refreshCurrent = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
    if (role) params.set('role', role);
    if (status) params.set('status', status);
    if (period) params.set('period', period);
    const d = await adminApi.admins(params.toString());
    setItems(d.items ?? []);
    setTotal(d.meta?.total ?? 0);
  }, [page, debouncedSearch, role, status, period]);

  const onAddAdmin = async (payload: {
    fullName: string;
    email: string;
    phoneNumber?: string;
    role: UiAdminRole;
  }) => {
    setActionError(null);
    setWorking(true);
    try {
      await adminApi.createAdmin(payload);
      setAddOpen(false);
      await refreshCurrent();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Could not add admin');
    } finally {
      setWorking(false);
    }
  };

  const onEditAdmin = async (
    id: string,
    payload: { fullName?: string; email?: string; phoneNumber?: string; role?: UiAdminRole },
  ) => {
    setActionError(null);
    setWorking(true);
    try {
      await adminApi.updateAdmin(id, payload);
      setEditOpen(false);
      await refreshCurrent();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Could not update admin');
    } finally {
      setWorking(false);
    }
  };

  const onSuspendAdmin = async () => {
    if (!activeAdmin) return;
    setActionError(null);
    setWorking(true);
    try {
      await adminApi.suspendAdmin(activeAdmin.id);
      setSuspendOpen(false);
      await refreshCurrent();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Could not suspend admin');
    } finally {
      setWorking(false);
    }
  };

  const onDeactivateAdmin = async () => {
    if (!activeAdmin) return;
    setActionError(null);
    setWorking(true);
    try {
      await adminApi.deactivateAdmin(activeAdmin.id);
      setDeactivateOpen(false);
      await refreshCurrent();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Could not deactivate admin');
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[#111827]">Admin management</h1>
        <p className="mt-1 text-sm text-[#6B7280]">Manage team access, roles, and account status.</p>
      </div>

      {actionError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert">
          {actionError}
          <button
            type="button"
            className="ml-2 font-semibold underline"
            onClick={() => setActionError(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <AdminToolbar
        search={searchInput}
        role={role}
        status={status}
        period={period}
        onSearchChange={setSearchInput}
        onRoleChange={(value) => {
          setRole(value);
          setPage(1);
        }}
        onStatusChange={(value) => {
          setStatus(value);
          setPage(1);
        }}
        onPeriodChange={(value) => {
          setPeriod(value);
          setPage(1);
        }}
        onAddAdmin={() => setAddOpen(true)}
      />

      <AdminTable
        data={items}
        loading={loading}
        page={page}
        totalPages={totalPages}
        selectedIds={selectedIds}
        menuOpenId={menuOpenId}
        error={error}
        onToggleAll={(checked) => setSelectedIds(checked ? items.map((i) => i.id) : [])}
        onToggleOne={(id, checked) =>
          setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((item) => item !== id)))
        }
        onMenuToggle={(id) => setMenuOpenId((prev) => (prev === id ? null : id))}
        onMenuClose={() => setMenuOpenId(null)}
        onView={(admin) => router.push(`/admin/admin-management/${admin.id}`)}
        onEdit={(admin) => {
          setActiveAdmin(admin);
          setEditOpen(true);
          setMenuOpenId(null);
        }}
        onSuspend={(admin) => {
          setActiveAdmin(admin);
          setSuspendOpen(true);
          setMenuOpenId(null);
        }}
        onDeactivate={(admin) => {
          setActiveAdmin(admin);
          setDeactivateOpen(true);
          setMenuOpenId(null);
        }}
        onPageChange={setPage}
      />

      <AddAdminModal open={addOpen} loading={working} onClose={() => setAddOpen(false)} onSubmit={onAddAdmin} />
      <EditAdminModal
        open={editOpen}
        admin={activeAdmin}
        loading={working}
        onClose={() => setEditOpen(false)}
        onSubmit={onEditAdmin}
      />
      <SuspendAdminModal
        open={suspendOpen}
        loading={working}
        onClose={() => setSuspendOpen(false)}
        onConfirm={onSuspendAdmin}
      />
      <DeactivateAdminModal
        open={deactivateOpen}
        loading={working}
        onClose={() => setDeactivateOpen(false)}
        onConfirm={onDeactivateAdmin}
      />
    </div>
  );
}
