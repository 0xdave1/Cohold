'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '@/lib/admin/api';
import type { LedgerReconciliationReport } from '@/lib/admin/ledger-reconciliation';
import { formatDecimalMoneyForDisplay } from '@/lib/money/format-display';

export default function AdminLedgerReconciliationPage() {
  const [data, setData] = useState<LedgerReconciliationReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await adminApi.ledgerReconciliation();
      setData(d);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : 'Failed to load reconciliation report');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Ledger reconciliation</h1>
          <p className="text-sm text-gray-600">
            Read-only view of wallet vs ledger sums and operation integrity (super-admin). No automatic repairs.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      {loading && !data ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : data ? (
        <div className="space-y-8">
          <p className="text-xs text-gray-500">Generated {new Date(data.generatedAt).toLocaleString()}</p>

          <section>
            <h2 className="text-sm font-semibold text-gray-900">Wallet balance mismatches</h2>
            <p className="text-xs text-gray-600 mb-2">Stored wallet balance vs sum of completed transaction legs.</p>
            {data.walletBalanceMismatches.length === 0 ? (
              <p className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-lg px-3 py-2">None detected.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-amber-200 bg-amber-50">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-amber-200 text-xs uppercase text-amber-900">
                    <tr>
                      <th className="px-3 py-2">Wallet</th>
                      <th className="px-3 py-2">User</th>
                      <th className="px-3 py-2">Stored</th>
                      <th className="px-3 py-2">Ledger sum</th>
                      <th className="px-3 py-2">Delta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.walletBalanceMismatches.map((r) => (
                      <tr key={r.walletId} className="border-b border-amber-100">
                        <td className="px-3 py-2 font-mono text-xs">{r.walletId.slice(0, 8)}…</td>
                        <td className="px-3 py-2 font-mono text-xs">{r.userId.slice(0, 8)}…</td>
                        <td className="px-3 py-2">
                          {r.currency} {formatDecimalMoneyForDisplay(r.storedBalance, r.currency)}
                        </td>
                        <td className="px-3 py-2">
                          {r.currency} {formatDecimalMoneyForDisplay(r.ledgerSum, r.currency)}
                        </td>
                        <td className="px-3 py-2 font-semibold text-amber-950">
                          {r.currency} {formatDecimalMoneyForDisplay(r.delta, r.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-gray-900">Transactions without ledger operation</h3>
              <p className="mt-2 text-2xl font-bold text-gray-900">{data.transactionsWithoutLedgerOperation}</p>
              <p className="text-xs text-gray-500 mt-1">Completed legs not yet linked to a LedgerOperation (legacy or pending backfill).</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-gray-900">Short / unbalanced operations</h3>
              <p className="text-xs text-gray-600 mt-1">
                Short: {data.shortLedgerOperations.length} — Unbalanced: {data.unbalancedLedgerOperations.length}
              </p>
            </div>
          </section>

          {data.unbalancedLedgerOperations.length > 0 ? (
            <section>
              <h2 className="text-sm font-semibold text-red-900 mb-2">Unbalanced ledger operations</h2>
              <ul className="space-y-2 text-sm">
                {data.unbalancedLedgerOperations.map((o) => (
                  <li key={o.ledgerOperationId} className="rounded border border-red-200 bg-red-50 px-3 py-2">
                    <span className="font-mono text-xs">{o.reference}</span> — debit {o.debitTotal} vs credit{' '}
                    {o.creditTotal}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {data.shortLedgerOperations.length > 0 ? (
            <section>
              <h2 className="text-sm font-semibold text-amber-900 mb-2">Operations with fewer than two legs</h2>
              <ul className="space-y-2 text-sm">
                {data.shortLedgerOperations.map((o) => (
                  <li key={o.ledgerOperationId} className="rounded border border-amber-200 bg-amber-50 px-3 py-2">
                    <span className="font-mono text-xs">{o.reference}</span> — {o.legCount} leg(s)
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
