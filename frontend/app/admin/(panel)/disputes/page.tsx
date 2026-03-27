'use client';

import { useEffect, useState } from 'react';
import { DataTable, type Column } from '@/components/admin/DataTable';
import { adminApi } from '@/lib/admin/api';
import type { Dispute } from '@/lib/admin/types';

const STATUS_BADGE: Record<string, string> = {
  OPEN: 'bg-amber-100 text-amber-700',
  RESOLVED: 'bg-green-100 text-green-700',
  CLOSED: 'bg-gray-100 text-gray-600',
};

const columns: Column<Dispute>[] = [
  { key: 'user', header: 'User', render: (r) => r.user ? [r.user.firstName, r.user.lastName].filter(Boolean).join(' ') || r.user.email : r.userId },
  { key: 'property', header: 'Property', render: (r) => r.property?.title ?? '—' },
  { key: 'issue', header: 'Issue', render: (r) => <span className="max-w-xs truncate block">{r.issue}</span> },
  {
    key: 'status', header: 'Status',
    render: (r) => (
      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[r.status] ?? 'bg-gray-100 text-gray-600'}`}>
        {r.status}
      </span>
    ),
  },
];

export default function DisputesPage() {
  const [items, setItems] = useState<Dispute[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const limit = 20;

  useEffect(() => {
    setLoading(true);
    adminApi.disputes(`page=${page}&limit=${limit}`)
      .then((d: any) => { setItems(d.items ?? d ?? []); setTotal(d.meta?.total ?? 0); })
      .catch(() => { setItems([]); })
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Disputes</h1>
      <DataTable columns={columns} data={items} page={page} totalPages={Math.ceil(total / limit) || 1} onPageChange={setPage} loading={loading} emptyMessage="No disputes found." />
    </div>
  );
}
