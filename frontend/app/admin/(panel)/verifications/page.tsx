'use client';

import { useEffect, useState } from 'react';
import { DataTable, type Column } from '@/components/admin/DataTable';
import { AdminReasonDialog } from '@/components/admin/AdminReasonDialog';
import { adminApi } from '@/lib/admin/api';
import { useAdminApproveKyc, useAdminRejectKyc } from '@/lib/admin/use-admin-kyc-review';
import type { KycVerification } from '@/lib/admin/types';
import { maskSensitiveId } from '@/lib/kyc/identity';
import { canReviewKyc } from '@/lib/admin/permissions';
import { mapApiError } from '@/lib/api/security-errors';
import { useAuthStore } from '@/stores/auth.store';

const STATUS_BADGE: Record<string, string> = {
  VERIFIED: 'bg-green-100 text-green-700',
  PENDING: 'bg-amber-100 text-amber-700',
  PENDING_REVIEW: 'bg-amber-100 text-amber-700',
  SUBMITTED: 'bg-amber-100 text-amber-700',
  FAILED: 'bg-red-100 text-red-700',
  REJECTED: 'bg-red-100 text-red-700',
  RESUBMITTED: 'bg-orange-100 text-orange-700',
  MANUAL_REVIEW: 'bg-indigo-100 text-indigo-700',
  REVOKED: 'bg-gray-100 text-gray-700',
  REQUIRES_REVIEW: 'bg-blue-100 text-blue-700',
};

export default function VerificationsPage() {
  const adminRole = useAuthStore((s) => s.adminRole);
  const canAct = canReviewKyc(adminRole);
  const [items, setItems] = useState<KycVerification[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const approveKyc = useAdminApproveKyc();
  const rejectKyc = useAdminRejectKyc();
  const limit = 20;

  const load = () => {
    setLoading(true);
    setListError(null);
    adminApi
      .verifications(`page=${page}&limit=${limit}`)
      .then((d: any) => {
        setItems(d.items ?? d ?? []);
        setTotal(d.meta?.total ?? 0);
      })
      .catch((e) => {
        setItems([]);
        setListError(mapApiError(e).message);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, [page]);

  const handleApprove = async (id: string) => {
    if (!canAct) return;
    const confirmed = window.confirm('Approve this KYC verification?');
    if (!confirmed) return;
    setActing(id);
    try {
      await approveKyc.mutateAsync(id);
      load();
    } catch (e: unknown) {
      setListError(mapApiError(e).message);
    }
    setActing(null);
  };

  const columns: Column<KycVerification>[] = [
    {
      key: 'user', header: 'User',
      render: (r) => [r.user?.firstName, r.user?.lastName].filter(Boolean).join(' ') || r.user?.email || r.userId,
    },
    { key: 'governmentIdType', header: 'Document type', render: (r) => r.governmentIdType ?? '—' },
    {
      key: 'governmentIdNumber',
      header: 'Identity',
      render: (r) => maskSensitiveId(r.governmentIdMasked ?? r.governmentIdNumber) ?? '—',
    },
    {
      key: 'status', header: 'Status',
      render: (r) => (
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[r.status] ?? 'bg-gray-100 text-gray-600'}`}>
          {r.status}
        </span>
      ),
    },
    { key: 'createdAt', header: 'Submitted', render: (r) => new Date(r.createdAt).toLocaleDateString() },
    {
      key: 'actions', header: 'Actions',
      render: (r) => ['PENDING', 'PENDING_REVIEW', 'SUBMITTED', 'REQUIRES_REVIEW', 'MANUAL_REVIEW', 'RESUBMITTED'].includes(r.status) ? (
        <div className="flex gap-2">
          <button type="button" disabled={!canAct || acting === r.id} onClick={() => void handleApprove(r.id)} className="rounded-lg bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50">Approve</button>
          <button type="button" disabled={!canAct || acting === r.id} onClick={() => setRejectId(r.id)} className="rounded-lg bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50">Reject</button>
        </div>
      ) : <span className="text-xs text-gray-400">—</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Verifications</h1>
      {!canAct ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          You do not have permission to approve or reject KYC for this account role.
        </p>
      ) : null}
      {listError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {listError}
        </p>
      ) : null}
      <DataTable columns={columns} data={items} page={page} totalPages={Math.ceil(total / limit) || 1} onPageChange={setPage} loading={loading} emptyMessage="No verifications found." />
      <AdminReasonDialog
        open={rejectId != null}
        title="Reject KYC verification"
        description="Provide a clear rejection reason (sent to the server as failureReason)."
        confirmLabel="Reject"
        onClose={() => setRejectId(null)}
        onConfirm={async (failureReason) => {
          if (!rejectId) return;
          await rejectKyc.mutateAsync({ verificationId: rejectId, failureReason });
          setRejectId(null);
          load();
        }}
      />
    </div>
  );
}
