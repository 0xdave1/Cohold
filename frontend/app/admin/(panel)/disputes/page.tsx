'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { DataTable, type Column } from '@/components/admin/DataTable';
import { adminApi } from '@/lib/admin/api';
import type { AdminSupportConversation } from '@/lib/admin/support-types';
import { mapApiError } from '@/lib/api/security-errors';
import { CATEGORY_LABEL } from '@/components/admin-support/support-constants';

const STATUS_BADGE: Record<string, string> = {
  OPEN: 'bg-amber-100 text-amber-700',
  LIVE: 'bg-amber-100 text-amber-700',
  WAITING_FOR_ADMIN: 'bg-rose-100 text-rose-800',
  WAITING_FOR_USER: 'bg-sky-100 text-sky-800',
  RESOLVED: 'bg-green-100 text-green-700',
  CLOSED: 'bg-gray-100 text-gray-600',
};

function userLabel(row: AdminSupportConversation): string {
  const u = row.user;
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
  return name || u.email;
}

const columns: Column<AdminSupportConversation>[] = [
  {
    key: 'referenceCode',
    header: 'Reference',
    render: (r) => <span className="font-mono text-xs">{r.referenceCode}</span>,
  },
  { key: 'user', header: 'User', render: (r) => userLabel(r) },
  {
    key: 'category',
    header: 'Category',
    render: (r) => <span className="text-xs">{CATEGORY_LABEL[r.category] ?? r.category}</span>,
  },
  {
    key: 'subject',
    header: 'Subject',
    render: (r) => <span className="max-w-xs truncate block text-xs">{r.subject ?? '—'}</span>,
  },
  {
    key: 'status',
    header: 'Status',
    render: (r) => (
      <span
        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[r.status] ?? 'bg-gray-100 text-gray-600'}`}
      >
        {r.status}
      </span>
    ),
  },
  {
    key: 'assigned',
    header: 'Assigned',
    render: (r) => <span className="text-xs">{r.assignedAdmin?.fullName ?? r.assignedAdmin?.email ?? '—'}</span>,
  },
  {
    key: 'lastMessageAt',
    header: 'Last activity',
    render: (r) => <span className="text-xs text-gray-600">{new Date(r.lastMessageAt).toLocaleString()}</span>,
  },
  {
    key: 'actions',
    header: '',
    render: () => (
      <Link href="/admin/support" className="text-xs font-medium text-[#1a3a4a] underline">
        Support inbox
      </Link>
    ),
  },
];

export default function DisputesPage() {
  const [items, setItems] = useState<AdminSupportConversation[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const limit = 20;

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    adminApi
      .disputes(`page=${page}&limit=${limit}`)
      .then((d: { items?: AdminSupportConversation[]; meta?: { total?: number } }) => {
        setItems(Array.isArray(d.items) ? d.items : []);
        setTotal(typeof d.meta?.total === 'number' ? d.meta.total : 0);
      })
      .catch((e: unknown) => {
        setItems([]);
        setTotal(0);
        setError(mapApiError(e).message);
      })
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Disputes"
        description="Dispute-flagged support conversations from the server (isDispute). This is not a separate legal case tracker."
      />
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
        </div>
      ) : null}
      <DataTable
        columns={columns}
        data={items}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        loading={loading}
        emptyMessage="No open dispute-flagged conversations in this page."
      />
    </div>
  );
}
