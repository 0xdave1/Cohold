'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { FundWalletCard } from '@/components/wallet/FundWalletCard';
import { useVirtualAccounts, useWalletBalances, formatMoney, useDevWalletCredit } from '@/lib/hooks/use-wallet';

function WalletPageInner() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { data: balances, isLoading: balLoading, refetch: refetchBalances } = useWalletBalances();
  const { data: accounts, isLoading: vaLoading } = useVirtualAccounts();
  const devCredit = useDevWalletCredit();

  useEffect(() => {
    if (searchParams.get('status') === 'success') {
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
      refetchBalances();
    }
  }, [searchParams, queryClient, refetchBalances]);

  const ngn = balances?.find((w) => w.currency === 'NGN');
  const va = accounts?.find((a) => a.currency === 'NGN') ?? accounts?.[0];

  const isDev = process.env.NODE_ENV !== 'production';

  return (
    <div className="space-y-6 px-4 pt-4 pb-24">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/home"
          className="p-2 rounded-lg hover:bg-dashboard-border/50 text-dashboard-heading"
          aria-label="Back"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-xl font-semibold text-dashboard-heading">Wallet</h1>
      </div>

      <div className="rounded-2xl border border-dashboard-border bg-dashboard-card p-4">
        <p className="text-xs text-dashboard-body mb-1">NGN balance</p>
        {balLoading ? (
          <div className="h-8 w-40 animate-pulse rounded bg-dashboard-border/40" />
        ) : (
          <p className="text-2xl font-semibold text-dashboard-heading">
            {ngn ? formatMoney(ngn.balance, 'NGN') : '—'}
          </p>
        )}
      </div>

      <FundWalletCard />

      <div className="rounded-2xl border border-dashboard-border bg-dashboard-card p-4">
        <h2 className="text-sm font-semibold text-dashboard-heading mb-3">Bank transfer</h2>
        {vaLoading ? (
          <div className="h-20 animate-pulse rounded-xl bg-dashboard-border/30" />
        ) : va ? (
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-dashboard-body">Account number</dt>
              <dd className="font-mono text-dashboard-heading">{va.accountNumber}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-dashboard-body">Bank name</dt>
              <dd className="text-dashboard-heading">{va.bankName}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-dashboard-body">Account name</dt>
              <dd className="text-dashboard-heading">{va.accountName}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-dashboard-body">Account will appear after KYC approval</p>
        )}
      </div>

      {isDev && (
        <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/50 p-4">
          <p className="text-xs text-amber-900 mb-2">Development only</p>
          <button
            type="button"
            disabled={devCredit.isPending}
            onClick={() => devCredit.mutate({ amount: '1000', currency: 'NGN' })}
            className="w-full rounded-xl border border-amber-400 bg-white py-3 text-sm font-semibold text-amber-900"
          >
            {devCredit.isPending ? 'Adding…' : 'Add Test Funds'}
          </button>
        </div>
      )}
    </div>
  );
}

export default function WalletPage() {
  return (
    <Suspense fallback={<div className="p-4 text-dashboard-body">Loading…</div>}>
      <WalletPageInner />
    </Suspense>
  );
}
