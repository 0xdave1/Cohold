'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '@/lib/admin/api';
import { adminWithdrawalListBadge } from '@/lib/withdrawals/status';

type AdminWithdrawalRow = {
  id: string;
  userId: string;
  reference: string;
  amount: string;
  currency: string;
  status: string;
  failureReason?: string | null;
  providerReference?: string | null;
  providerTransferCode?: string | null;
  providerStatus?: string | null;
  providerLastCheckedAt?: string | null;
  reconciliationConflict?: boolean;
  reconciliationConflictReason?: string | null;
  reconciliationConflictAt?: string | null;
  updatedAt: string;
};

const BADGE: Record<string, string> = {
  COMPLETED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-700',
};

export default function AdminWithdrawalsPage() {
  const [items, setItems] = useState<AdminWithdrawalRow[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [stuckOnly, setStuckOnly] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [batchBusy, setBatchBusy] = useState(false);
  const [opsError, setOpsError] = useState<string | null>(null);
  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (stuckOnly) {
        q.set('stuckOnly', 'true');
        q.set('olderThanMinutes', '60');
      }
      const d = await adminApi.withdrawals(q.toString());
      setItems(d.items ?? []);
      setTotal(d.meta?.total ?? 0);
    } catch {
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, stuckOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  const reconcileOne = async (id: string) => {
    setOpsError(null);
    setActionId(id);
    try {
      await adminApi.reconcileWithdrawal(id);
      await load();
    } catch {
      setOpsError('Reconcile failed. Check network or permissions.');
    } finally {
      setActionId(null);
    }
  };

  const reconcileStale = async () => {
    setOpsError(null);
    setBatchBusy(true);
    try {
      await adminApi.reconcileStaleWithdrawals('olderThanMinutes=30');
      await load();
    } catch {
      setOpsError('Batch reconcile failed (SUPER_ADMIN only).');
    } finally {
      setBatchBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Withdrawals (ops)</h1>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={stuckOnly}
              onChange={(e) => {
                setStuckOnly(e.target.checked);
                setPage(1);
              }}
            />
            Stuck / reconciliation only
          </label>
          <button
            type="button"
            disabled={batchBusy}
            onClick={() => void reconcileStale()}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
          >
            {batchBusy ? 'Running…' : 'Reconcile stale (batch)'}
          </button>
        </div>
      </div>
      <p className="text-sm text-gray-600">
        Uses server endpoints <code className="rounded bg-gray-100 px-1">GET /admin/withdrawals</code> and{' '}
        <code className="rounded bg-gray-100 px-1">POST /admin/withdrawals/:id/reconcile</code>. Batch reconcile requires
        SUPER_ADMIN.
      </p>
      {opsError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {opsError}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500">No rows.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase text-gray-600">
              <tr>
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Ref</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Provider</th>
                <th className="px-3 py-2">Conflict / failure</th>
                <th className="px-3 py-2">Updated</th>
                <th className="px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => {
                const { label: statusLabel, badgeClass: conflictBadgeClass } = adminWithdrawalListBadge(r);
                const badgeClass = conflictBadgeClass ?? BADGE[r.status] ?? 'bg-amber-50 text-amber-900';
                const conflictNote = r.reconciliationConflict
                  ? [r.reconciliationConflictReason, r.reconciliationConflictAt]
                      .filter(Boolean)
                      .join(' · ')
                  : '';
                return (
                  <tr key={r.id} className="border-b border-gray-100">
                    <td className="px-3 py-2 font-mono text-xs">{r.userId.slice(0, 8)}…</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.reference}</td>
                    <td className="px-3 py-2">
                      {r.currency} {r.amount}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${badgeClass}`}>
                        {statusLabel}
                      </span>
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-2 text-xs text-gray-600" title={r.providerTransferCode ?? ''}>
                      {r.providerStatus ?? '—'}
                      {r.providerTransferCode ? <span className="block text-[10px] text-gray-400">id {r.providerTransferCode}</span> : null}
                      {r.providerLastCheckedAt ? (
                        <span className="block text-[10px] text-gray-400">
                          checked {new Date(r.providerLastCheckedAt).toLocaleString()}
                        </span>
                      ) : null}
                    </td>
                    <td className="max-w-[220px] truncate px-3 py-2 text-xs text-red-700" title={conflictNote || r.failureReason || ''}>
                      {r.reconciliationConflict ? (
                        <span className="font-semibold text-rose-900">{conflictNote || 'Reconciliation conflict'}</span>
                      ) : (
                        (r.failureReason ?? '—')
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">{new Date(r.updatedAt).toLocaleString()}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        disabled={!!actionId}
                        onClick={() => void reconcileOne(r.id)}
                        className="text-xs font-semibold text-[#1a3a4a] underline disabled:opacity-50"
                      >
                        {actionId === r.id ? '…' : 'Reconcile'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex justify-between border-t border-gray-100 px-3 py-2 text-xs text-gray-500">
            <span>
              Page {page} — {total} total
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                className="font-medium text-[#1a3a4a] disabled:opacity-40"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </button>
              <button
                type="button"
                disabled={page * limit >= total}
                className="font-medium text-[#1a3a4a] disabled:opacity-40"
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
