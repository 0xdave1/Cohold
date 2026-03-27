'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useReferrals } from '@/lib/hooks/use-referrals';
import { formatMoney } from '@/lib/hooks/use-wallet';
import { Gift, Copy, Eye, EyeOff } from 'lucide-react';
import { EmptyState } from '@/components/dashboard/EmptyState';

export default function ReferralsPage() {
  const { data, isLoading } = useReferrals();
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

  const earnings = data?.earnings ?? '0';
  const code = data?.referralCode ?? null;
  const referrals = data?.referrals ?? [];
  const shareUrl = typeof window !== 'undefined' ? (code ? window.location.origin + '/signup?ref=' + encodeURIComponent(code) : window.location.origin + '/signup') : '';

  return (
    <div className="min-h-screen bg-dashboard-bg pb-20">
      <div className="space-y-6 px-4 pt-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/account" className="p-2 rounded-lg hover:bg-dashboard-border/50 text-dashboard-heading" aria-label="Back">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </Link>
          <h1 className="text-xl font-semibold text-dashboard-heading">Referrals</h1>
        </div>
        <p className="text-sm text-dashboard-body">Invite friends and earn when they join.</p>

        {isLoading ? (
          <div className="rounded-2xl border border-dashboard-border bg-dashboard-card p-6 animate-pulse h-40" />
        ) : (
          <>
            <div className="rounded-2xl border border-dashboard-border bg-dashboard-card p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-dashboard-body">Referral earnings</span>
                <button type="button" onClick={() => setVisible(!visible)} className="p-1 text-dashboard-muted hover:text-dashboard-heading" aria-label={visible ? 'Hide amount' : 'Show amount'}>
                  {visible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <p className="text-2xl font-bold text-dashboard-heading">{visible ? formatMoney(earnings, 'NGN') : '••••••'}</p>
              <div className="mt-4 flex items-center gap-2 flex-wrap">
                <span className="text-sm text-dashboard-body">Referral code:</span>
                <span className="font-mono font-medium text-dashboard-heading">{code ?? '-'}</span>
                {code && (
                  <button type="button" onClick={() => copy(code)} className="p-1.5 rounded-lg hover:bg-dashboard-border/50 text-dashboard-body" aria-label="Copy code">
                    <Copy className="h-4 w-4" />
                  </button>
                )}
                {copied && <span className="text-xs text-green-600">Copied</span>}
              </div>
            </div>

            <section>
              <h2 className="text-sm font-semibold text-dashboard-heading mb-3">Referred users</h2>
              {referrals.length === 0 ? (
                <EmptyState
                  title="No referrals yet."
                  message="Share your link to earn."
                  icon={<Gift className="h-7 w-7" />}
                  cta={{ label: 'Share referral link', onClick: () => copy(shareUrl) }}
                  className="p-6"
                />
              ) : (
                <div className="space-y-2">
                  {referrals.map((r) => (
                    <div key={r.id} className="rounded-xl border border-dashboard-border bg-dashboard-card p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-cohold-icon-bg flex items-center justify-center text-sm font-semibold text-dashboard-heading">
                          {r.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-dashboard-heading">{r.name}</p>
                          <p className="text-xs text-dashboard-body">{r.date}</p>
                        </div>
                      </div>
                      <span className="text-sm font-medium text-green-600">+{formatMoney(r.earnings, 'NGN')}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {referrals.length > 0 && (
              <button
                type="button"
                onClick={() => copy(shareUrl)}
                className="w-full rounded-xl bg-cohold-blue py-3 text-sm font-medium text-white hover:opacity-90 flex items-center justify-center gap-2"
              >
                <Gift className="h-4 w-4" /> Share referral link
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
