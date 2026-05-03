'use client';

import { useEffect, useState } from 'react';
import { DataTable, type Column } from '@/components/admin/DataTable';
import { adminApi } from '@/lib/admin/api';
import { formatDecimalMoneyForDisplay } from '@/lib/money/format-display';

interface FeeLog {
  id: string;
  type: string;
  amount: string;
  currency: string;
  reference: string;
  userId: string | null;
  createdAt: string;
}

const columns: Column<FeeLog>[] = [
  { key: 'reference', header: 'Reference', render: (r) => <span className="font-mono text-xs">{r.reference}</span> },
  { key: 'type', header: 'Fee type' },
  { key: 'amount', header: 'Amount', render: (r) => formatDecimalMoneyForDisplay(r.amount, r.currency) },
  { key: 'userId', header: 'User ID', render: (r) => r.userId ?? '—' },
  { key: 'createdAt', header: 'Date', render: (r) => new Date(r.createdAt).toLocaleDateString() },
];

export default function FeeLogsPage() {
  const [items, setItems] = useState<FeeLog[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const limit = 20;

  useEffect(() => {
    setLoading(true);
    adminApi.fees(`page=${page}&limit=${limit}`)
      .then((d: any) => { setItems(d.items ?? d ?? []); setTotal(d.meta?.total ?? 0); })
      .catch(() => { setItems([]); })
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Fee logs</h1>
      <DataTable columns={columns} data={items} page={page} totalPages={Math.ceil(total / limit) || 1} onPageChange={setPage} loading={loading} emptyMessage="No fee records found." />
    </div>
  );
}
