'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/lib/admin/api';
import { mapApiError } from '@/lib/api/security-errors';
import { canViewOps } from '@/lib/admin/permissions';
import { useAuthStore } from '@/stores/auth.store';
import { Loader2, AlertTriangle, ShieldAlert, ClipboardList } from 'lucide-react';

type LaunchBlocker = { code: string; message: string; count?: number };
type LaunchWarning = LaunchBlocker;

export default function AdminLaunchReadinessPage() {
  const adminRole = useAuthStore((s) => s.adminRole);
  const allowed = canViewOps(adminRole);

  const q = useQuery({
    queryKey: ['admin', 'launch-readiness'],
    queryFn: () => adminApi.launchReadiness(),
    enabled: allowed,
    retry: (n, err) => {
      const k = mapApiError(err).kind;
      if (k === 'forbidden' || k === 'unauthenticated') return false;
      return n < 2;
    },
  });

  if (!allowed) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-xl font-semibold text-gray-900">Launch readiness</h1>
        <p className="mt-2 text-sm text-gray-600">Your role does not include operational launch signals. Contact a compliance or super admin.</p>
        <Link href="/admin/dashboard" className="mt-4 inline-block text-sm font-medium text-[#1a3a4a] underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const data = q.data as Record<string, unknown> | undefined;
  const blockers = (data?.blockers as LaunchBlocker[] | undefined) ?? [];
  const warnings = (data?.warnings as LaunchWarning[] | undefined) ?? [];
  const issue7 = data?.issue7InvestmentConcurrency as { status?: string; detail?: string } | undefined;
  const assessmentNote = typeof data?.assessmentNote === 'string' ? data.assessmentNote : '';
  const counts = (data?.counts as Record<string, number> | undefined) ?? {};
  const financialOps = (data?.financialOps as Record<string, unknown> | undefined) ?? null;

  const hasAutomatedBlockers = blockers.length > 0;
  const manualBlockers = issue7?.status === 'MANUAL_CHECK_REQUIRED';

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <ClipboardList className="h-7 w-7 text-[#1a3a4a]" aria-hidden />
            Launch readiness
          </h1>
          <p className="mt-1 text-sm text-gray-600 max-w-2xl">
            Aggregated operational signals only. This page never certifies production readiness, legal sign-off, or security review.
          </p>
        </div>
        <button
          type="button"
          onClick={() => q.refetch()}
          disabled={q.isFetching}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
        >
          {q.isFetching ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {q.isLoading ? (
        <div className="flex justify-center py-16 text-gray-500">
          <Loader2 className="h-8 w-8 animate-spin" aria-label="Loading" />
        </div>
      ) : q.isError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900" role="alert">
          {mapApiError(q.error).message}
        </div>
      ) : (
        <>
          <section
            className={`rounded-xl border p-4 ${
              hasAutomatedBlockers || manualBlockers ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white'
            }`}
            aria-labelledby="launch-status-heading"
          >
            <h2 id="launch-status-heading" className="text-sm font-semibold text-gray-900">
              Status
            </h2>
            <p className="mt-2 text-sm text-gray-700">
              {hasAutomatedBlockers || manualBlockers
                ? 'Do not treat the platform as launch-ready until automated blockers are cleared and manual checks (including investment concurrency) are signed off.'
                : 'No automated blockers detected in this snapshot. Manual checks may still be required before launch.'}
            </p>
            {assessmentNote ? <p className="mt-2 text-xs text-gray-600">{assessmentNote}</p> : null}
          </section>

          <section className="rounded-xl border border-rose-200 bg-rose-50/80 p-4" aria-labelledby="issue7-heading">
            <div className="flex items-start gap-2">
              <ShieldAlert className="h-5 w-5 text-rose-800 shrink-0 mt-0.5" aria-hidden />
              <div>
                <h2 id="issue7-heading" className="text-sm font-semibold text-rose-950">
                  Investment concurrency (Issue 7)
                </h2>
                <p className="mt-1 text-xs font-mono uppercase text-rose-900">{issue7?.status ?? 'MANUAL_CHECK_REQUIRED'}</p>
                <p className="mt-2 text-sm text-rose-900">{issue7?.detail}</p>
              </div>
            </div>
          </section>

          {blockers.length > 0 ? (
            <section className="rounded-xl border border-rose-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-rose-900 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" aria-hidden />
                Blockers ({blockers.length})
              </h2>
              <ul className="mt-3 space-y-2 text-sm text-gray-800">
                {blockers.map((b) => (
                  <li key={b.code} className="border-b border-rose-100 pb-2 last:border-0">
                    <span className="font-mono text-xs text-rose-800">{b.code}</span>
                    <p>{b.message}</p>
                    {typeof b.count === 'number' ? <p className="text-xs text-gray-600">Count: {b.count}</p> : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {warnings.length > 0 ? (
            <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
              <h2 className="text-sm font-semibold text-amber-950">Warnings ({warnings.length})</h2>
              <ul className="mt-3 space-y-2 text-sm text-amber-950">
                {warnings.map((w) => (
                  <li key={w.code}>
                    <span className="font-mono text-xs">{w.code}</span>
                    <p>{w.message}</p>
                    {typeof w.count === 'number' ? <p className="text-xs opacity-80">Count: {w.count}</p> : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-gray-900">Operational counts</h2>
            <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              {Object.entries(counts).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2 border-b border-gray-100 py-1">
                  <dt className="text-gray-600">{k}</dt>
                  <dd className="font-medium text-gray-900">{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <h2 className="text-sm font-semibold text-gray-900">Financial ops snapshot</h2>
            <pre className="mt-2 max-h-80 overflow-auto text-xs text-gray-800 whitespace-pre-wrap break-words">
              {JSON.stringify(financialOps, null, 2)}
            </pre>
          </section>
        </>
      )}
    </div>
  );
}
