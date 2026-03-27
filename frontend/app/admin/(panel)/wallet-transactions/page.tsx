'use client';

import { useEffect, useState } from 'react';
import { DataTable, type Column } from '@/components/admin/DataTable';
import { adminApi } from '@/lib/admin/api';
import type { WalletTransaction } from '@/lib/admin/types';

const STATUS_BADGE: Record<string, string> = {
  COMPLETED: 'bg-green-100 text-green-700',
  PENDING: 'bg-amber-100 text-amber-700',
  FAILED: 'bg-red-100 text-red-700',
};

const columns: Column<WalletTransaction>[] = [
  { key: 'reference', header: 'Reference', render: (r) => <span className="font-mono text-xs">{r.reference}</span> },
  { key: 'user', header: 'User', render: (r) => r.user ? [r.user.firstName, r.user.lastName].filter(Boolean).join(' ') || r.user.email : r.userId ?? '—' },
  { key: 'type', header: 'Type' },
  { key: 'amount', header: 'Amount', render: (r) => `${r.currency} ${parseFloat(r.amount).toLocaleString()}` },
  { key: 'direction', header: 'Direction', render: (r) => <span className={r.direction === 'CREDIT' ? 'text-green-600' : 'text-gray-700'}>{r.direction}</span> },
  {
    key: 'status', header: 'Status',
    render: (r) => (
      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[r.status] ?? 'bg-gray-100 text-gray-600'}`}>
        {r.status}
      </span>
    ),
  },
  { key: 'createdAt', header: 'Date', render: (r) => new Date(r.createdAt).toLocaleDateString() },
];

export default function WalletTransactionsPage() {
  const [items, setItems] = useState<WalletTransaction[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const limit = 20;

  useEffect(() => {
    setLoading(true);
    adminApi.walletTransactions(`page=${page}&limit=${limit}`)
      .then((d: any) => { setItems(d.items ?? d ?? []); setTotal(d.meta?.total ?? 0); })
      .catch(() => { setItems([]); })
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Wallet transactions</h1>
      <DataTable columns={columns} data={items} page={page} totalPages={Math.ceil(total / limit) || 1} onPageChange={setPage} loading={loading} />
    </div>
  );
}
