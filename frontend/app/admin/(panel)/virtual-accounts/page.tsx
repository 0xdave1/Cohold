'use client';

import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/admin/api';
import type { AdminVirtualAccountProvisioningRow } from '@/lib/admin/types';
import { AdminReasonDialog } from '@/components/admin/AdminReasonDialog';
import { canRetryVirtualAccount, canViewVirtualAccountOps } from '@/lib/admin/permissions';
import { mapApiError } from '@/lib/api/security-errors';
import { useAuthStore } from '@/stores/auth.store';

export default function AdminVirtualAccountsPage() {
  const adminRole = useAuthStore((s) => s.adminRole);
  const canView = canViewVirtualAccountOps(adminRole);
  const canRetry = canRetryVirtualAccount(adminRole);
  const [rows, setRows] = useState<AdminVirtualAccountProvisioningRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [retryUserId, setRetryUserId] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    adminApi
      .failedVirtualAccounts('limit=100')
      .then((d: any) => setRows(Array.isArray(d) ? d : []))
      .catch((e) => {
        setRows([]);
        setError(mapApiError(e).message);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Virtual accounts</h1>
        <p className="text-sm text-gray-500">Failed or retry-required virtual account provisioning records.</p>
      </div>
      {!canView ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
          This workspace is not available for your admin role. The API limits failed virtual account lists to
          Approver, Compliance, and Super admin roles.
        </div>
      ) : null}
      {canView && !canRetry ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Retry is not available for your role from this panel.
        </p>
      ) : null}
      {canView && error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      {canView ? (
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">User</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Reason</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Retry count</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Last attempt</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                    Loading...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                    No failed virtual account records.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-b border-gray-100">
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">{row.userId}</td>
                    <td className="px-4 py-3 text-gray-700">{row.status}</td>
                    <td className="px-4 py-3 text-gray-600">{row.failureReason ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{row.retryCount ?? 0}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {row.lastProvisionAttemptAt ? new Date(row.lastProvisionAttemptAt).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => {
                          setError(null);
                          setRetryUserId(row.userId);
                        }}
                        disabled={!canRetry || busyUserId != null}
                        className="rounded-lg bg-[#1a3a4a] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        {busyUserId === row.userId ? 'Retrying…' : 'Retry'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      ) : null}

      <AdminReasonDialog
        open={retryUserId != null}
        title="Retry virtual account provisioning"
        description="A reason is required before retry (server-enforced). After success, this list refreshes from the server — do not assume active until reload shows it."
        confirmLabel="Retry provisioning"
        onClose={() => setRetryUserId(null)}
        onConfirm={async (reason) => {
          if (!retryUserId) return;
          setBusyUserId(retryUserId);
          try {
            await adminApi.retryVirtualAccountProvisioning(retryUserId, { reason });
            setRetryUserId(null);
            load();
          } catch (e: unknown) {
            setError(mapApiError(e).message);
            throw e;
          } finally {
            setBusyUserId(null);
          }
        }}
      />
    </div>
  );
}
