'use client';

import { useEffect, useState } from 'react';
import { DataTable, type Column } from '@/components/admin/DataTable';
import { adminApi } from '@/lib/admin/api';
import type { KycVerification } from '@/lib/admin/types';

const STATUS_BADGE: Record<string, string> = {
  VERIFIED: 'bg-green-100 text-green-700',
  PENDING: 'bg-amber-100 text-amber-700',
  FAILED: 'bg-red-100 text-red-700',
  REQUIRES_REVIEW: 'bg-blue-100 text-blue-700',
};

export default function VerificationsPage() {
  const [items, setItems] = useState<KycVerification[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const limit = 20;

  const load = () => {
    setLoading(true);
    adminApi.verifications(`page=${page}&limit=${limit}`)
      .then((d: any) => { setItems(d.items ?? d ?? []); setTotal(d.meta?.total ?? 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, [page]);

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    setActing(id);
    try {
      if (action === 'approve') await adminApi.approveKyc(id);
      else await adminApi.rejectKyc(id);
      load();
    } catch { /* ignore */ }
    setActing(null);
  };

  const columns: Column<KycVerification>[] = [
    {
      key: 'user', header: 'User',
      render: (r) => [r.user?.firstName, r.user?.lastName].filter(Boolean).join(' ') || r.user?.email || r.userId,
    },
    { key: 'governmentIdType', header: 'Document type', render: (r) => r.governmentIdType ?? '—' },
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
      render: (r) => r.status === 'PENDING' || r.status === 'REQUIRES_REVIEW' ? (
        <div className="flex gap-2">
          <button type="button" disabled={acting === r.id} onClick={() => handleAction(r.id, 'approve')} className="rounded-lg bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50">Approve</button>
          <button type="button" disabled={acting === r.id} onClick={() => handleAction(r.id, 'reject')} className="rounded-lg bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50">Reject</button>
        </div>
      ) : <span className="text-xs text-gray-400">—</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Verifications</h1>
      <DataTable columns={columns} data={items} page={page} totalPages={Math.ceil(total / limit) || 1} onPageChange={setPage} loading={loading} />
    </div>
  );
}
