'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AdminReasonDialog } from '@/components/admin/AdminReasonDialog';
import { adminApi, type AdminOutboxEvent, type AdminOutboxStatus } from '@/lib/admin/api';
import { mapApiError } from '@/lib/api/security-errors';
import { deriveJobHealth, safeOutboxPayloadPreview, shouldPauseOpsPolling } from '@/lib/admin/ops-visibility';
import {
  buildDashboardExceptionMetrics,
  buildPrimaryDashboardMetrics,
  formatMetricDisplay,
  mergeOpsSummaryIntoExceptions,
  type DashboardMetric,
} from '@/lib/admin/dashboard-metrics';
import { canViewOps } from '@/lib/admin/permissions';
import { useAuthStore } from '@/stores/auth.store';

function outboxStatusCopy(status: AdminOutboxStatus): string {
  switch (status) {
    case 'PENDING':
      return 'Pending';
    case 'PROCESSING':
      return 'Processing';
    case 'FAILED':
      return 'Failed';
    case 'DEAD_LETTER':
      return 'Manual attention required';
    case 'COMPLETED':
      return 'Completed';
    case 'CANCELLED':
      return 'Cancelled';
    default:
      return status;
  }
}

function toneBorder(tone: DashboardMetric['tone']): string {
  if (tone === 'critical') return 'border-rose-200 bg-rose-50/80';
  if (tone === 'attention') return 'border-amber-200 bg-amber-50/80';
  return 'border-gray-200 bg-white';
}

export default function AdminDashboardPage() {
  const adminRole = useAuthStore((s) => s.adminRole);
  const showOps = canViewOps(adminRole);

  const overviewQuery = useQuery({
    queryKey: ['admin', 'dashboard', 'overview'],
    queryFn: () => adminApi.dashboard(),
  });

  const opsSummaryQuery = useQuery({
    queryKey: ['admin', 'ops', 'summary'],
    queryFn: () => adminApi.opsSummary(),
    enabled: showOps,
    retry: (failureCount, err) => {
      const k = mapApiError(err).kind;
      if (k === 'forbidden' || k === 'unauthenticated') return false;
      return failureCount < 2;
    },
  });

  const [outboxStatusFilter, setOutboxStatusFilter] = useState<'ALL' | AdminOutboxStatus>('ALL');
  const [outboxTypeFilter, setOutboxTypeFilter] = useState('');

  const outboxQuery = useQuery({
    queryKey: ['admin', 'ops', 'outbox', outboxStatusFilter, outboxTypeFilter],
    queryFn: async () => {
      const q = new URLSearchParams({ limit: '100' });
      if (outboxStatusFilter !== 'ALL') q.set('status', outboxStatusFilter);
      if (outboxTypeFilter.trim()) q.set('type', outboxTypeFilter.trim());
      return adminApi.outbox(q.toString());
    },
    enabled: showOps,
    refetchInterval: (query) => {
      if (query.state.error && shouldPauseOpsPolling(query.state.error)) return false;
      const rows = (query.state.data ?? []) as AdminOutboxEvent[];
      return rows.some((r) => r.status === 'PENDING' || r.status === 'PROCESSING') ? 15_000 : false;
    },
  });

  const deadLetterQuery = useQuery({
    queryKey: ['admin', 'ops', 'dead-letter'],
    queryFn: async () => adminApi.deadLetterOutbox('limit=100'),
    enabled: showOps,
  });

  const jobsQuery = useQuery({
    queryKey: ['admin', 'ops', 'jobs'],
    queryFn: async () => adminApi.jobsRegistry(),
    enabled: showOps,
    refetchInterval: (query) => {
      if (query.state.error && shouldPauseOpsPolling(query.state.error)) return false;
      return 30_000;
    },
  });

  const [retryDialog, setRetryDialog] = useState<{ id: string } | null>(null);

  const retryMutation = useMutation({
    mutationFn: async (id: string) => adminApi.retryOutbox(id),
    onSuccess: async () => {
      await Promise.all([outboxQuery.refetch(), deadLetterQuery.refetch()]);
    },
  });

  const overview = overviewQuery.data as Record<string, unknown> | undefined;
  const opsSummary = opsSummaryQuery.data as Record<string, unknown> | undefined;

  const exceptionMetrics = useMemo(() => {
    const base = buildDashboardExceptionMetrics(overview ?? null);
    return mergeOpsSummaryIntoExceptions(base, opsSummary ?? null);
  }, [overview, opsSummary]);

  const primaryMetrics = useMemo(() => buildPrimaryDashboardMetrics(overview ?? null), [overview]);

  const outboxRows = outboxQuery.data ?? [];
  const deadLetterRows = useMemo(() => deadLetterQuery.data ?? [], [deadLetterQuery.data]);
  const jobs = jobsQuery.data ?? [];

  const retryableIds = useMemo(() => new Set(deadLetterRows.map((r) => r.id)), [deadLetterRows]);

  const opsSummaryErr = opsSummaryQuery.error ? mapApiError(opsSummaryQuery.error) : null;
  const outboxErrorCopy = outboxQuery.error ? mapApiError(outboxQuery.error).message : null;
  const jobsErrorCopy = jobsQuery.error ? mapApiError(jobsQuery.error).message : null;

  if (overviewQuery.isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl border border-gray-200 bg-white" />
          ))}
        </div>
      </div>
    );
  }

  if (overviewQuery.isError) {
    const err = mapApiError(overviewQuery.error);
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            err.kind === 'forbidden' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-red-200 bg-red-50 text-red-800'
          }`}
          role="alert"
        >
          {err.message}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
          {adminRole ? (
            <p className="text-xs text-gray-500">
              Signed in role (from token): <span className="font-mono font-medium text-gray-700">{adminRole}</span>
            </p>
          ) : null}
        </div>
      </div>

      {opsSummaryErr && showOps ? (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            opsSummaryErr.kind === 'forbidden' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-gray-200 bg-gray-50 text-gray-800'
          }`}
          role="status"
        >
          {opsSummaryErr.kind === 'forbidden'
            ? 'Financial ops summary is not available for your role.'
            : opsSummaryErr.message}
        </div>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-900">Operational attention</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {exceptionMetrics.map((m) => {
            const { primary, sub } = formatMetricDisplay(m);
            return (
              <div
                key={m.key}
                className={`rounded-xl border p-4 shadow-sm ${toneBorder(m.tone)}`}
              >
                <p className="text-xs font-medium text-gray-600">{m.label}</p>
                <p className="mt-1 text-2xl font-semibold text-gray-900">{primary}</p>
                {sub ? <p className="mt-1 text-xs text-gray-500">{sub}</p> : null}
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-900">Overview</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {primaryMetrics.map((m) => {
            const { primary, sub } = formatMetricDisplay(m);
            return (
              <div key={m.key} className={`rounded-xl border p-4 shadow-sm ${toneBorder(m.tone)}`}>
                <p className="text-xs font-medium text-gray-600">{m.label}</p>
                <p className="mt-1 text-xl font-semibold text-gray-900">{primary}</p>
                {sub ? <p className="mt-1 text-xs text-gray-500">{sub}</p> : null}
              </div>
            );
          })}
        </div>
      </section>

      {!showOps ? (
        <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
          Outbox, job registry, and extended ops polling require <strong>Compliance</strong> or <strong>Super admin</strong>{' '}
          role. Other metrics above remain available when the server allows them.
        </p>
      ) : null}

      {showOps ? (
        <>
          <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-gray-900">Ops outbox</h2>
              <div className="flex items-center gap-2">
                <select
                  value={outboxStatusFilter}
                  onChange={(e) => setOutboxStatusFilter(e.target.value as 'ALL' | AdminOutboxStatus)}
                  className="rounded-lg border border-gray-200 px-2 py-1 text-xs"
                >
                  <option value="ALL">All status</option>
                  <option value="PENDING">Pending</option>
                  <option value="PROCESSING">Processing</option>
                  <option value="FAILED">Failed</option>
                  <option value="DEAD_LETTER">Dead-letter</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
                <input
                  value={outboxTypeFilter}
                  onChange={(e) => setOutboxTypeFilter(e.target.value)}
                  placeholder="type filter"
                  className="rounded-lg border border-gray-200 px-2 py-1 text-xs"
                />
                <button
                  type="button"
                  onClick={() => void Promise.all([outboxQuery.refetch(), deadLetterQuery.refetch(), jobsQuery.refetch()])}
                  className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-medium text-[#1a3a4a]"
                >
                  Refresh
                </button>
              </div>
            </div>
            {outboxErrorCopy ? (
              <p className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-900">{outboxErrorCopy}</p>
            ) : null}
            <div className="overflow-x-auto rounded-lg border border-gray-100">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-gray-50 text-[11px] uppercase text-gray-600">
                  <tr>
                    <th className="px-2 py-2">Type</th>
                    <th className="px-2 py-2">Aggregate</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2">Attempts</th>
                    <th className="px-2 py-2">Next</th>
                    <th className="px-2 py-2">Last error</th>
                    <th className="px-2 py-2">Payload</th>
                    <th className="px-2 py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {outboxRows.map((row) => {
                    const preview = safeOutboxPayloadPreview(row);
                    const canRetry = retryableIds.has(row.id) || row.status === 'DEAD_LETTER';
                    return (
                      <tr key={row.id} className="border-t border-gray-100">
                        <td className="px-2 py-2">{row.type}</td>
                        <td className="px-2 py-2">
                          <div>{row.aggregateType}</div>
                          <div className="font-mono text-[10px] text-gray-500">{row.aggregateId ?? '—'}</div>
                        </td>
                        <td className="px-2 py-2">{outboxStatusCopy(row.status)}</td>
                        <td className="px-2 py-2">
                          {row.attempts}/{row.maxAttempts}
                        </td>
                        <td className="px-2 py-2">{row.nextAttemptAt ? new Date(row.nextAttemptAt).toLocaleString() : '—'}</td>
                        <td className="max-w-[220px] truncate px-2 py-2" title={row.lastError ?? ''}>
                          {row.lastError ?? '—'}
                        </td>
                        <td className="max-w-[240px] truncate px-2 py-2" title={preview ?? ''}>
                          {preview ?? 'Hidden until sanitized payload is provided'}
                        </td>
                        <td className="px-2 py-2">
                          <button
                            type="button"
                            disabled={!canRetry || retryMutation.isPending}
                            onClick={() => {
                              if (!canRetry) return;
                              setRetryDialog({ id: row.id });
                            }}
                            className="text-xs font-medium text-[#1a3a4a] underline disabled:opacity-40"
                          >
                            {retryMutation.isPending && retryMutation.variables === row.id ? 'Retrying…' : 'Retry'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {outboxRows.length === 0 ? (
                    <tr>
                      <td className="px-2 py-3 text-gray-500" colSpan={8}>
                        No outbox rows.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="text-lg font-semibold text-gray-900">Job registry</h2>
            {jobsErrorCopy ? (
              <p className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-900">{jobsErrorCopy}</p>
            ) : null}
            <div className="overflow-x-auto rounded-lg border border-gray-100">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-gray-50 text-[11px] uppercase text-gray-600">
                  <tr>
                    <th className="px-2 py-2">Job</th>
                    <th className="px-2 py-2">Enabled</th>
                    <th className="px-2 py-2">Health</th>
                    <th className="px-2 py-2">Last run</th>
                    <th className="px-2 py-2">Last success</th>
                    <th className="px-2 py-2">Last failure</th>
                    <th className="px-2 py-2">Next run</th>
                    <th className="px-2 py-2">Last error</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr key={job.name} className="border-t border-gray-100">
                      <td className="px-2 py-2 font-medium">{job.name}</td>
                      <td className="px-2 py-2">{job.enabled ? 'Yes' : 'No'}</td>
                      <td className="px-2 py-2">
                        {deriveJobHealth(job) === 'healthy'
                          ? 'Healthy'
                          : deriveJobHealth(job) === 'degraded'
                            ? 'Degraded'
                            : 'Unknown'}
                      </td>
                      <td className="px-2 py-2">{job.lastRunAt ? new Date(job.lastRunAt).toLocaleString() : '—'}</td>
                      <td className="px-2 py-2">{job.lastSuccessAt ? new Date(job.lastSuccessAt).toLocaleString() : '—'}</td>
                      <td className="px-2 py-2">{job.lastFailureAt ? new Date(job.lastFailureAt).toLocaleString() : '—'}</td>
                      <td className="px-2 py-2">{job.nextRunAt ? new Date(job.nextRunAt).toLocaleString() : '—'}</td>
                      <td className="max-w-[220px] truncate px-2 py-2" title={job.lastError ?? ''}>
                        {job.lastError ?? '—'}
                      </td>
                    </tr>
                  ))}
                  {jobs.length === 0 ? (
                    <tr>
                      <td className="px-2 py-3 text-gray-500" colSpan={8}>
                        No job state rows.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}

      <AdminReasonDialog
        open={retryDialog != null}
        title="Retry dead-letter outbox event"
        description="Enter an operational reason (required for your audit trail). The retry request itself may not yet attach this text server-side."
        confirmLabel="Retry"
        onClose={() => setRetryDialog(null)}
        onConfirm={async (_reason: string) => {
          if (!retryDialog) return;
          await retryMutation.mutateAsync(retryDialog.id);
        }}
      />
    </div>
  );
}
