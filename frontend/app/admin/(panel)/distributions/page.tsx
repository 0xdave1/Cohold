'use client';

import { useMemo, useState } from 'react';
import { adminApi } from '@/lib/admin/api';
import { canProcessDistribution } from '@/lib/admin/permissions';
import { mapApiError } from '@/lib/api/security-errors';
import { useAdminDistributionBatches, useAdminIncomeEvents } from '@/lib/hooks/use-distributions';
import { useAuthStore } from '@/stores/auth.store';

export default function AdminDistributionsPage() {
  const adminRole = useAuthStore((s) => s.adminRole);
  const canMutate = canProcessDistribution(adminRole);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const { data: incomeEvents = [], isLoading: incomeLoading, refetch: refetchIncome } = useAdminIncomeEvents();
  const { data: batches = [], isLoading: batchLoading, refetch: refetchBatches } = useAdminDistributionBatches();
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [failedItems, setFailedItems] = useState<any[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const activeBatch = useMemo(
    () => batches.find((b: any) => b.id === activeBatchId) ?? null,
    [batches, activeBatchId],
  );

  const refresh = async () => {
    await Promise.all([refetchIncome(), refetchBatches()]);
  };

  const processBatch = async (id: string) => {
    if (!canMutate) return;
    if (!window.confirm('Process this distribution batch? This triggers server-side payouts and ledger work.')) return;
    setBusyAction(`process:${id}`);
    setActionError(null);
    try {
      await adminApi.processDistributionBatch(id);
      await refresh();
    } catch (e: unknown) {
      setActionError(mapApiError(e).message);
    } finally {
      setBusyAction(null);
    }
  };

  const retryFailed = async (id: string) => {
    if (!canMutate) return;
    if (
      !window.confirm(
        'Retry all failed line items in this batch? Confirm only after reviewing failure reasons — the server re-attempts payouts.',
      )
    ) {
      return;
    }
    setBusyAction(`retry:${id}`);
    setActionError(null);
    try {
      await adminApi.retryFailedDistributionItems(id);
      const failed = await adminApi.failedDistributionItems(id);
      setFailedItems(Array.isArray(failed) ? failed : []);
      await refresh();
    } catch (e: unknown) {
      setActionError(mapApiError(e).message);
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Income and distributions</h1>
        <p className="text-sm text-gray-500">
          Manage realized income events and distribution batches. Projected annual yield is not treated as paid income.
        </p>
      </div>

      {!canMutate ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">
          Process and retry-failed actions require Approver, Compliance, or Super admin. You can still review income
          events and batch metadata when the API allows it.
        </div>
      ) : null}

      {actionError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {actionError}
        </div>
      ) : null}

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-gray-900">Income events</h2>
        {incomeLoading ? (
          <p className="text-sm text-gray-400">Loading income events…</p>
        ) : incomeEvents.length === 0 ? (
          <p className="text-sm text-gray-500">No income events yet.</p>
        ) : (
          <div className="space-y-2">
            {incomeEvents.slice(0, 10).map((e: any) => (
              <div key={e.id} className="rounded-lg border border-gray-200 px-3 py-2 text-xs">
                <p className="font-semibold text-gray-900">
                  {e.propertyId} · {e.amount} {e.currency} · {e.status}
                </p>
                <p className="text-gray-600">
                  Period: {e.periodStart ? String(e.periodStart).slice(0, 10) : '—'} to{' '}
                  {e.periodEnd ? String(e.periodEnd).slice(0, 10) : '—'}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-gray-900">Distribution batches</h2>
        {batchLoading ? (
          <p className="text-sm text-gray-400">Loading distribution batches…</p>
        ) : batches.length === 0 ? (
          <p className="text-sm text-gray-500">No distribution batches yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                  <th className="px-2 py-2">Property</th>
                  <th className="px-2 py-2">Period</th>
                  <th className="px-2 py-2">Gross</th>
                  <th className="px-2 py-2">Expenses</th>
                  <th className="px-2 py-2">Fee</th>
                  <th className="px-2 py-2">Net</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Items</th>
                  <th className="px-2 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b: any) => (
                  <tr key={b.id} className="border-b border-gray-100">
                    <td className="px-2 py-2 text-xs">{b.propertyId}</td>
                    <td className="px-2 py-2 text-xs">
                      {b.periodStart ? String(b.periodStart).slice(0, 10) : '—'} to{' '}
                      {b.periodEnd ? String(b.periodEnd).slice(0, 10) : '—'}
                    </td>
                    <td className="px-2 py-2 text-xs">{b.grossIncome}</td>
                    <td className="px-2 py-2 text-xs">{b.expenses}</td>
                    <td className="px-2 py-2 text-xs">{b.platformFee}</td>
                    <td className="px-2 py-2 text-xs font-medium">{b.netDistributable}</td>
                    <td className="px-2 py-2 text-xs">{b.status}</td>
                    <td className="px-2 py-2 text-xs">{Array.isArray(b.items) ? b.items.length : 0}</td>
                    <td className="px-2 py-2 text-xs">
                      <div className="flex gap-1">
                        <button
                          className="rounded bg-gray-900 px-2 py-1 text-white disabled:opacity-50"
                          disabled={busyAction != null}
                          onClick={() => {
                            setActiveBatchId(b.id);
                            adminApi.failedDistributionItems(b.id).then((r) => setFailedItems(Array.isArray(r) ? r : []));
                          }}
                        >
                          View
                        </button>
                        <button
                          className="rounded bg-[#1a3a4a] px-2 py-1 text-white disabled:opacity-50"
                          disabled={
                            busyAction != null ||
                            !canMutate ||
                            !['APPROVED', 'PROCESSING', 'PARTIALLY_FAILED'].includes(String(b.status))
                          }
                          onClick={() => processBatch(b.id)}
                        >
                          {busyAction === `process:${b.id}` ? 'Processing…' : 'Process'}
                        </button>
                        <button
                          className="rounded bg-amber-700 px-2 py-1 text-white disabled:opacity-50"
                          disabled={busyAction != null || !canMutate}
                          onClick={() => retryFailed(b.id)}
                        >
                          {busyAction === `retry:${b.id}` ? 'Retrying…' : 'Retry failed'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {activeBatch ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-900">Batch detail</h2>
          <p className="mt-1 text-xs text-gray-600">Reference: {activeBatch.reference ?? '—'}</p>
          <p className="text-xs text-gray-600">Status: {activeBatch.status}</p>
          <p className="text-xs text-gray-600">Failed items: {failedItems.length}</p>
          {failedItems.length > 0 ? (
            <div className="mt-2 space-y-1">
              {failedItems.slice(0, 10).map((i: any) => (
                <p key={i.id} className="text-xs text-red-700">
                  {i.userId}: {i.failureReason ?? 'Failed'}
                </p>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs text-gray-500">No failed items for selected batch.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
