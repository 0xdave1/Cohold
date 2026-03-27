'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { AdminDetailCard } from '@/components/admin-management/AdminDetailCard';
import { SuspendAdminModal } from '@/components/admin-management/modals/SuspendAdminModal';
import { adminApi } from '@/lib/admin/api';
import type { AdminUser } from '@/lib/admin/types';

export default function AdminManagementDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    adminApi
      .adminDetail(id)
      .then((data: AdminUser) => setAdmin(data))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load admin detail'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const onSuspend = async () => {
    if (!admin) return;
    setActionError(null);
    setWorking(true);
    try {
      await adminApi.suspendAdmin(admin.id);
      setSuspendOpen(false);
      load();
      router.refresh();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Could not suspend admin');
    } finally {
      setWorking(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-32 animate-pulse rounded-lg bg-[#E5E7EB]" />
        <div className="h-64 animate-pulse rounded-2xl border border-[#E8E4DC] bg-white" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        <p className="font-semibold">Unable to load admin</p>
        <p className="mt-1">{error}</p>
        <Link
          href="/admin/admin-management"
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-red-900 underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to admin management
        </Link>
      </div>
    );
  }

  if (!admin) {
    return (
      <div className="rounded-2xl border border-[#E8E4DC] bg-white p-8 text-center text-sm text-[#6B7280]">
        Admin not found.
        <div className="mt-4">
          <Link href="/admin/admin-management" className="font-medium text-[#00416A] hover:underline">
            Return to list
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Link
          href="/admin/admin-management"
          className="inline-flex items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-medium text-[#374151] shadow-sm transition hover:bg-[#F9FAFB]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </div>

      {actionError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {actionError}
        </div>
      ) : null}

      <AdminDetailCard admin={admin} onSuspend={() => setSuspendOpen(true)} />

      <SuspendAdminModal
        open={suspendOpen}
        loading={working}
        onClose={() => setSuspendOpen(false)}
        onConfirm={onSuspend}
      />
    </div>
  );
}
