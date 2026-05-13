'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useReferrals } from '@/lib/hooks/use-referrals';
import { formatMoney } from '@/lib/hooks/use-wallet';
import { Gift, Copy, Eye, EyeOff } from 'lucide-react';
import { EmptyState } from '@/components/dashboard/EmptyState';
import { mapApiError } from '@/lib/api/security-errors';

export default function ReferralsPage() {
  const { data, isLoading, isError, error, refetch } = useReferrals();
  const [visible, setVisible] = useState(true);
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }, []);

  const rewardsImplemented = data != null && 'supported' in data && data.supported === true;
  const unsupportedReason =
    data != null && 'supported' in data && data.supported === false ? data.unsupportedReason : null;
  const code = data?.referralCode ?? null;
  const referralLink = data != null && 'referralLink' in data ? data.referralLink : null;
  const referrals =
    data != null && 'referrals' in data && Array.isArray(data.referrals) ? data.referrals : [];
  const earned = rewardsImplemented && data != null && 'earnedRewardsTotal' in data ? data.earnedRewardsTotal : null;
  const pending = rewardsImplemented && data != null && 'pendingRewardsTotal' in data ? data.pendingRewardsTotal : null;

  const shareUrl =
    typeof window !== 'undefined'
      ? referralLink ||
        (code ? `${window.location.origin}/signup?ref=${encodeURIComponent(code)}` : `${window.location.origin}/signup`)
      : '';

  return (
    <div className="min-h-screen bg-dashboard-bg pb-20">
      <div className="space-y-6 px-4 pt-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/account"
            className="p-2 rounded-lg hover:bg-dashboard-border/50 text-dashboard-heading"
            aria-label="Back to account"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-xl font-semibold text-dashboard-heading">Referrals</h1>
        </div>
        <p className="text-sm text-dashboard-body">
          Share Cohold with people you trust. Referral rewards only appear when the backend confirms ledger-backed payouts.
        </p>

        {isLoading ? (
          <div className="rounded-2xl border border-dashboard-border bg-dashboard-card p-6 animate-pulse h-40" />
        ) : isError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
            <p>{mapApiError(error).message}</p>
            <button type="button" className="mt-2 font-medium underline" onClick={() => refetch()}>
              Retry
            </button>
          </div>
        ) : (
          <>
            {!rewardsImplemented ? (
              <div className="rounded-2xl border border-dashboard-border bg-dashboard-card p-6 space-y-3">
                <p className="text-sm font-semibold text-dashboard-heading">Referral rewards not available</p>
                <p className="text-sm text-dashboard-body">
                  {unsupportedReason ??
                    'Referral program status could not be confirmed. You can still share the public signup link.'}
                </p>
                {code ? (
                  <div className="flex flex-wrap items-center gap-2 pt-2">
                    <span className="text-sm text-dashboard-body">Code:</span>
                    <span className="font-mono font-medium text-dashboard-heading">{code}</span>
                    <button
                      type="button"
                      onClick={() => copy(code)}
                      className="p-1.5 rounded-lg hover:bg-dashboard-border/50 text-dashboard-body"
                      aria-label="Copy referral code"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() => copy(shareUrl)}
                  className="w-full rounded-xl border border-dashboard-border py-3 text-sm font-medium text-dashboard-heading hover:bg-dashboard-border/30"
                >
                  Copy signup link
                </button>
              </div>
            ) : (
              <>
                <div className="rounded-2xl border border-dashboard-border bg-dashboard-card p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-dashboard-body">Earned rewards (ledger-backed)</span>
                    <button
                      type="button"
                      onClick={() => setVisible(!visible)}
                      className="p-1 text-dashboard-muted hover:text-dashboard-heading"
                      aria-label={visible ? 'Hide amounts' : 'Show amounts'}
                    >
                      {visible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  <p className="text-2xl font-bold text-dashboard-heading">
                    {earned != null && earned !== '' ? (visible ? formatMoney(earned, 'NGN') : '••••••') : 'Not available'}
                  </p>
                  {pending != null && pending !== '' ? (
                    <p className="text-xs text-dashboard-muted mt-2">Pending: {visible ? formatMoney(pending, 'NGN') : '••••••'}</p>
                  ) : null}
                  <div className="mt-4 flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-dashboard-body">Referral code:</span>
                    <span className="font-mono font-medium text-dashboard-heading">{code ?? '—'}</span>
                    {code ? (
                      <button
                        type="button"
                        onClick={() => copy(code)}
                        className="p-1.5 rounded-lg hover:bg-dashboard-border/50 text-dashboard-body"
                        aria-label="Copy referral code"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    ) : null}
                    {copied ? <span className="text-xs text-green-600">Copied</span> : null}
                  </div>
                </div>

                <section>
                  <h2 className="text-sm font-semibold text-dashboard-heading mb-3">Referred users</h2>
                  {referrals.length === 0 ? (
                    <EmptyState
                      title="No referrals yet."
                      message="Share your link. Earnings only show when confirmed by the server."
                      icon={<Gift className="h-7 w-7" />}
                      cta={{ label: 'Copy signup link', onClick: () => copy(shareUrl) }}
                      className="p-6"
                    />
                  ) : (
                    <div className="space-y-2">
                      {referrals.map((r) => (
                        <div
                          key={r.id}
                          className="rounded-xl border border-dashboard-border bg-dashboard-card p-4 flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-10 w-10 rounded-full bg-cohold-icon-bg flex items-center justify-center text-sm font-semibold text-dashboard-heading shrink-0">
                              {r.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-dashboard-heading truncate">{r.name}</p>
                              <p className="text-xs text-dashboard-body">{r.date}</p>
                            </div>
                          </div>
                          {r.earnings ? (
                            <span className="text-sm font-medium text-emerald-700 shrink-0">+{formatMoney(r.earnings, 'NGN')}</span>
                          ) : (
                            <span className="text-xs text-dashboard-muted shrink-0">—</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <button
                  type="button"
                  onClick={() => copy(shareUrl)}
                  className="w-full rounded-xl bg-cohold-blue py-3 text-sm font-medium text-white hover:opacity-90 flex items-center justify-center gap-2"
                >
                  <Gift className="h-4 w-4" aria-hidden /> Copy signup link
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
