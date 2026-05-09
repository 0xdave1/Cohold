'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminApi } from '@/lib/admin/api';
import { sanitizeObjectForDisplay } from '@/lib/admin/mask';
import { mapApiError } from '@/lib/api/security-errors';

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

type ActivityRow = {
  id: string;
  adminId: string;
  actorAdminId?: string | null;
  actorRole?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  previousValue?: unknown;
  nextValue?: unknown;
  reason?: string | null;
  metadata?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
};

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(sanitizeObjectForDisplay(value), null, 2);
  } catch {
    return '—';
  }
}

export default function AdminActivityLogPage() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(25);
  const [items, setItems] = useState<ActivityRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const q = new URLSearchParams({ page: String(page), limit: String(limit) });
    adminApi
      .activityLog(q.toString())
      .then((d: { items?: ActivityRow[]; meta?: { total?: number } }) => {
        setItems(Array.isArray(d.items) ? d.items : []);
        setTotal(typeof d.meta?.total === 'number' ? d.meta.total : 0);
      })
      .catch((e: unknown) => {
        setItems([]);
        setTotal(0);
        setError(mapApiError(e).message);
      })
      .finally(() => setLoading(false));
  }, [page, limit]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Admin activity log</h1>
          <p className="mt-1 text-sm text-gray-500">
            Immutable audit rows from the server. JSON fields are sanitized before display.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-gray-600">
            Per page
            <select
              value={limit}
              onChange={(e) => {
                setPage(1);
                setLimit(Number(e.target.value) as (typeof PAGE_SIZE_OPTIONS)[number]);
              }}
              className="ml-2 rounded-lg border border-gray-200 px-2 py-1 text-sm"
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => load()}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-[#1a3a4a]"
          >
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-[960px] w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-600">
              <tr>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Entity</th>
                <th className="px-3 py-2">Target</th>
                <th className="px-3 py-2">Reason</th>
                <th className="px-3 py-2">Metadata (sanitized)</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-gray-400">
                    Loading…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-gray-500">
                    No activity rows.
                  </td>
                </tr>
              ) : (
                items.map((row) => (
                  <tr key={row.id} className="border-t border-gray-100 align-top">
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-700">
                      {new Date(row.createdAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-xs font-medium text-gray-900">{row.action}</td>
                    <td className="px-3 py-2 text-xs text-gray-700">
                      {row.entityType}
                      <div className="font-mono text-[10px] text-gray-500">{row.entityId ?? '—'}</div>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-700">
                      {row.targetType ?? '—'}
                      <div className="font-mono text-[10px] text-gray-500">{row.targetId ?? '—'}</div>
                    </td>
                    <td className="max-w-[200px] px-3 py-2 text-xs text-gray-700">{row.reason ?? '—'}</td>
                    <td className="max-w-[360px] px-3 py-2">
                      <pre className="max-h-40 overflow-auto rounded bg-gray-50 p-2 text-[10px] text-gray-800">
                        {safeJson(row.metadata ?? row.nextValue ?? row.previousValue ?? null)}
                      </pre>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-gray-600">
        <span>
          Page {page} of {totalPages} · {total} total
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-lg border border-gray-200 px-3 py-1 disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="rounded-lg border border-gray-200 px-3 py-1 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
