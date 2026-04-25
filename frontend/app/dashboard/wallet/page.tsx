'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { FundWalletCard } from '@/components/wallet/FundWalletCard';
import { useWalletBalances, formatMoney, useDevWalletCredit, useVerifyWalletPayment } from '@/lib/hooks/use-wallet';

function WalletPageInner() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { data: balances, isLoading: balLoading, refetch: refetchBalances } = useWalletBalances();
  const verifyPayment = useVerifyWalletPayment();
  const devCredit = useDevWalletCredit();

  useEffect(() => {
    if (searchParams.get('status') === 'success') {
      const refFromQuery = searchParams.get('tx_ref') ?? searchParams.get('reference');
      const refFromSession =
        typeof window !== 'undefined' ? window.sessionStorage.getItem('walletFundingReference') : null;
      const reference = refFromQuery ?? refFromSession;
      if (reference && !verifyPayment.isPending) {
        verifyPayment.mutate(reference, {
          onSettled: () => {
            if (typeof window !== 'undefined') {
              window.sessionStorage.removeItem('walletFundingReference');
            }
          },
        });
      }
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
      refetchBalances();
    }
  }, [searchParams, queryClient, refetchBalances, verifyPayment]);

  const ngn = balances?.find((w) => w.currency === 'NGN');

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
