'use client';

import { useEffect, useState } from 'react';
import { DataTable, type Column } from '@/components/admin/DataTable';
import { adminApi } from '@/lib/admin/api';
import { formatDecimalMoneyForDisplay } from '@/lib/money/format-display';

interface Cohold {
  id: string;
  title: string;
  members: number;
  totalInvested: string;
  currency: string;
  status: string;
  createdAt: string;
}

const columns: Column<Cohold>[] = [
  { key: 'title', header: 'Name', render: (r) => <span className="font-medium text-gray-900">{r.title}</span> },
  { key: 'members', header: 'Members' },
  {
    key: 'totalInvested',
    header: 'Total invested',
    render: (r) => formatDecimalMoneyForDisplay(r.totalInvested || '0', r.currency),
  },
  {
    key: 'status', header: 'Status',
    render: (r) => (
      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${r.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
        {r.status}
      </span>
    ),
  },
  { key: 'createdAt', header: 'Created', render: (r) => new Date(r.createdAt).toLocaleDateString() },
];

export default function CoholdsPage() {
  const [items, setItems] = useState<Cohold[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const limit = 20;

  useEffect(() => {
    setLoading(true);
    adminApi.coholds(`page=${page}&limit=${limit}`)
      .then((d: any) => { setItems(d.items ?? d ?? []); setTotal(d.meta?.total ?? 0); })
      .catch(() => { setItems([]); })
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Cohold management</h1>
      <DataTable columns={columns} data={items} page={page} totalPages={Math.ceil(total / limit) || 1} onPageChange={setPage} loading={loading} emptyMessage="No coholds found." />
    </div>
  );
}
