'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AdminReasonDialog } from '@/components/admin/AdminReasonDialog';
import { AdminMetricCard } from '@/components/admin/AdminMetricCard';
import { adminApi, type AdminOutboxEvent, type AdminOutboxStatus } from '@/lib/admin/api';
import { mapApiError } from '@/lib/api/security-errors';
import { deriveJobHealth, safeOutboxPayloadPreview, shouldPauseOpsPolling } from '@/lib/admin/ops-visibility';
import {
  buildFigmaDashboardSections,
  mergeOpsSummaryIntoExceptions,
} from '@/lib/admin/dashboard-metrics';
import { canViewOps } from '@/lib/admin/permissions';
import { useAuthStore } from '@/stores/auth.store';
import { adminShellClass } from '@/lib/admin/admin-theme';

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

function MetricGrid({ metrics, loading }: { metrics: ReturnType<typeof buildFigmaDashboardSections>['userStats']; loading?: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((m) => (
        <AdminMetricCard key={m.key} metric={m} loading={loading} />
      ))}
    </div>
  );
}

export default function AdminDashboardPage() {
  const adminRole = useAuthStore((s) => s.adminRole);
  const showOps = canViewOps(adminRole);
  const [monthFilter, setMonthFilter] = useState('this_month');

  const overviewQuery = useQuery({
    queryKey: ['admin', 'dashboard', 'overview', monthFilter],
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

  const sections = useMemo(() => {
    const base = buildFigmaDashboardSections(overview ?? null);
    const opsMerged = mergeOpsSummaryIntoExceptions(base.operations, opsSummary ?? null);
    return { ...base, operations: opsMerged };
  }, [overview, opsSummary]);

  const outboxRows = outboxQuery.data ?? [];
  const deadLetterRows = useMemo(() => deadLetterQuery.data ?? [], [deadLetterQuery.data]);
  const jobs = jobsQuery.data ?? [];
  const retryableIds = useMemo(() => new Set(deadLetterRows.map((r) => r.id)), [deadLetterRows]);

  const opsSummaryErr = opsSummaryQuery.error ? mapApiError(opsSummaryQuery.error) : null;
  const outboxErrorCopy = outboxQuery.error ? mapApiError(outboxQuery.error).message : null;
  const jobsErrorCopy = jobsQuery.error ? mapApiError(jobsQuery.error).message : null;

  useEffect(() => {
    const onMonth = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (detail) setMonthFilter(detail);
    };
    window.addEventListener('admin-month-filter', onMonth as EventListener);
    return () => window.removeEventListener('admin-month-filter', onMonth as EventListener);
  }, []);

  if (overviewQuery.isLoading) {
    return (
      <div className="space-y-6">
        <h1 className={adminShellClass.pageTitle}>Dashboard</h1>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 16 }).map((_, i) => (
            <AdminMetricCard key={i} loading label="Loading" />
          ))}
        </div>
      </div>
    );
  }

  if (overviewQuery.isError) {
    const err = mapApiError(overviewQuery.error);
    return (
      <div className="space-y-4">
        <h1 className={adminShellClass.pageTitle}>Dashboard</h1>
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${adminShellClass.card} ${
            err.kind === 'forbidden' ? 'border-amber-200 text-amber-900' : 'border-red-200 text-red-800'
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
          <h1 className={adminShellClass.pageTitle}>Dashboard</h1>
          {monthFilter !== 'this_month' ? (
            <p className="mt-1 text-xs text-[#6F6A64]">
              Period filter is display-only until the overview API supports date ranges. Showing current server totals.
            </p>
          ) : null}
        </div>
        <div className="lg:hidden">
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="rounded-lg border border-[#DDD8D2] bg-white px-3 py-2 text-sm"
          >
            <option value="this_month">This month</option>
            <option value="last_month">Last month</option>
            <option value="all">All time</option>
          </select>
        </div>
      </div>

      {opsSummaryErr && showOps ? (
        <p className={`rounded-xl border px-3 py-2 text-sm ${adminShellClass.card} text-[#6F6A64]`} role="status">
          {opsSummaryErr.kind === 'forbidden'
            ? 'Financial ops summary is not available for your role.'
            : opsSummaryErr.message}
        </p>
      ) : null}

      <section className="space-y-3">
        <MetricGrid metrics={sections.userStats} />
      </section>

      <section className="space-y-3">
        <h2 className={adminShellClass.sectionTitle}>Investments</h2>
        <MetricGrid metrics={sections.investmentsByCurrency} />
      </section>

      <section className="space-y-3">
        <h2 className={adminShellClass.sectionTitle}>Wallet balances</h2>
        <MetricGrid metrics={sections.walletsByCurrency} />
      </section>

      <section className="space-y-3">
        <h2 className={adminShellClass.sectionTitle}>Listings</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {sections.listings.map((m) => (
            <AdminMetricCard key={m.key} metric={m} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className={adminShellClass.sectionTitle}>Operations</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {sections.operations.map((m) => (
            <AdminMetricCard key={m.key} metric={m} className="min-h-[120px]" />
          ))}
        </div>
      </section>

      {!showOps ? (
        <p className={`rounded-xl border px-3 py-2 text-sm text-[#6F6A64] ${adminShellClass.card}`}>
          Outbox and job registry require Compliance or Super admin role.
        </p>
      ) : null}

      {showOps ? (
        <>
          <section id="ops-outbox" className={`space-y-3 scroll-mt-6 p-4 ${adminShellClass.card}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className={adminShellClass.sectionTitle}>Ops outbox</h2>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={outboxStatusFilter}
                  onChange={(e) => setOutboxStatusFilter(e.target.value as 'ALL' | AdminOutboxStatus)}
                  className="rounded-lg border border-[#DDD8D2] bg-white px-2 py-1 text-xs"
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
                  className="rounded-lg border border-[#DDD8D2] bg-white px-2 py-1 text-xs"
                />
                <button
                  type="button"
                  onClick={() => void Promise.all([outboxQuery.refetch(), deadLetterQuery.refetch(), jobsQuery.refetch()])}
                  className="rounded-lg border border-[#DDD8D2] bg-white px-3 py-1 text-xs font-medium text-[#054870]"
                >
                  Refresh
                </button>
              </div>
            </div>
            {outboxErrorCopy ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-900">{outboxErrorCopy}</p>
            ) : null}
            <div className="overflow-x-auto rounded-lg border border-[#DDD8D2]">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-[#F5F1EC] text-[11px] uppercase text-[#6F6A64]">
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
                      <tr key={row.id} className="border-t border-[#DDD8D2]/80">
                        <td className="px-2 py-2 text-[#171717]">{row.type}</td>
                        <td className="px-2 py-2">
                          <div>{row.aggregateType}</div>
                          <div className="font-mono text-[10px] text-[#6F6A64]">{row.aggregateId ?? '—'}</div>
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
                            className="text-xs font-medium text-[#054870] underline disabled:opacity-40"
                          >
                            {retryMutation.isPending && retryMutation.variables === row.id ? 'Retrying…' : 'Retry'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {outboxRows.length === 0 ? (
                    <tr>
                      <td className="px-2 py-3 text-[#6F6A64]" colSpan={8}>
                        No outbox rows.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className={`space-y-3 p-4 ${adminShellClass.card}`}>
            <h2 className={adminShellClass.sectionTitle}>Job registry</h2>
            {jobsErrorCopy ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-900">{jobsErrorCopy}</p>
            ) : null}
            <div className="overflow-x-auto rounded-lg border border-[#DDD8D2]">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-[#F5F1EC] text-[11px] uppercase text-[#6F6A64]">
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
                    <tr key={job.name} className="border-t border-[#DDD8D2]/80">
                      <td className="px-2 py-2 font-medium text-[#171717]">{job.name}</td>
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
                      <td className="px-2 py-3 text-[#6F6A64]" colSpan={8}>
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
        description="Enter an operational reason (required for your audit trail)."
        confirmLabel="Retry"
        onClose={() => setRetryDialog(null)}
        onConfirm={async () => {
          if (!retryDialog) return;
          await retryMutation.mutateAsync(retryDialog.id);
        }}
      />
    </div>
  );
}
