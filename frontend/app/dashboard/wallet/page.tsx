'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { FundWalletCard } from '@/components/wallet/FundWalletCard';
import {
  useWalletBalances,
  formatMoney,
  useDevWalletCredit,
  useVerifyWalletPayment,
  useMyVirtualAccount,
  useRetryVirtualAccountProvisioning,
  useWalletTransactions,
} from '@/lib/hooks/use-wallet';
import { mapFinancialIntegrityError } from '@/lib/finance/financial-errors';
import { useKycStatus } from '@/lib/hooks/use-kyc';

function isPaymentCallback(searchParams: URLSearchParams): boolean {
  return (
    searchParams.get('payment') === 'callback' ||
    searchParams.get('status') === 'success'
  );
}

function WalletPageInner() {
  const searchParams = useSearchParams();
  const { data: balances, isLoading: balLoading, refetch: refetchBalances } = useWalletBalances();
  const verifyPayment = useVerifyWalletPayment();
  const devCredit = useDevWalletCredit();
  const virtualAccount = useMyVirtualAccount();
  const retryProvisioning = useRetryVirtualAccountProvisioning();
  const { data: kyc } = useKycStatus();
  const { refetch: refetchTransactions } = useWalletTransactions({ limit: 10 });

  const paymentCallback = isPaymentCallback(searchParams);

  useEffect(() => {
    if (!paymentCallback) return;
    const refFromQuery = searchParams.get('tx_ref') ?? searchParams.get('reference');
    const refFromSession =
      typeof window !== 'undefined' ? window.sessionStorage.getItem('walletFundingReference') : null;
    const reference = refFromQuery ?? refFromSession;
    if (reference && !verifyPayment.isPending && !verifyPayment.isSuccess && !verifyPayment.isError) {
      verifyPayment.mutate(reference, {
        onSettled: () => {
          if (typeof window !== 'undefined') {
            window.sessionStorage.removeItem('walletFundingReference');
          }
          void refetchBalances();
          void refetchTransactions();
        },
      });
    }
    // Do not invalidate/refetch balances here — only after verify succeeds
    // (`useVerifyWalletPayment` onSuccess). Callback also refetches on settled for honest pending UX.
  }, [paymentCallback, searchParams, verifyPayment, refetchBalances, refetchTransactions]);

  const ngn = balances?.find((w) => w.currency === 'NGN');
  const isVerified = kyc?.status === 'VERIFIED';
  const isDev = process.env.NODE_ENV !== 'production';

  const verifyStatus = verifyPayment.data?.status;
  const requiresReconciliation = verifyStatus === 'REQUIRES_RECONCILIATION';

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
        <p className="mt-2 text-[11px] text-dashboard-muted">
          Balance always comes from the server after ledger settlement — not from checkout redirect alone.
        </p>
      </div>

      {paymentCallback ? (
        <div className="rounded-xl border border-dashboard-border bg-dashboard-card px-4 py-3 text-sm">
          {verifyPayment.isPending ? (
            <p className="text-amber-900">
              Payment submitted. Confirming wallet funding… Your balance updates only after our servers verify
              Paystack payment (this may take a moment if the webhook is delayed).
            </p>
          ) : verifyPayment.isSuccess && verifyPayment.data?.credited ? (
            <p className="text-green-800">Payment verified. Your wallet balance has been refreshed from the server.</p>
          ) : verifyPayment.isSuccess && !verifyPayment.data?.credited ? (
            <p className="text-dashboard-body">
              Payment already recorded. Refreshing wallet from the server…
            </p>
          ) : requiresReconciliation ? (
            <p className="text-amber-950" role="alert">
              Payment was received by Paystack but wallet settlement needs reconciliation. Please contact{' '}
              <Link href="/dashboard/support" className="font-semibold text-cohold-blue underline">
                support
              </Link>{' '}
              with your payment reference.
            </p>
          ) : verifyPayment.isError ? (
            <p className="text-red-800" role="alert">
              {mapFinancialIntegrityError(
                verifyPayment.error,
                'Payment could not be verified yet. Your balance was not changed. If you completed payment, wait a moment and refresh — or contact support.',
              )}
            </p>
          ) : (
            <p className="text-dashboard-body">
              Payment submitted. Confirming wallet funding… If verification does not start, open Wallet again from the
              menu.
            </p>
          )}
        </div>
      ) : null}

      <div className="rounded-2xl border border-dashboard-border bg-dashboard-card p-4">
        <h2 className="mb-2 text-sm font-semibold text-dashboard-heading">Bank transfer (dedicated account)</h2>
        {!isVerified ? (
          <div className="space-y-2 text-sm text-dashboard-body">
            <p>Bank transfer funding is available only after your KYC status is VERIFIED.</p>
            <Link href="/dashboard/kyc" className="inline-flex text-cohold-blue underline">
              Complete KYC
            </Link>
          </div>
        ) : virtualAccount.isLoading ? (
          <p className="text-sm text-dashboard-body">Loading your dedicated account status…</p>
        ) : virtualAccount.data?.status === 'ACTIVE' ? (
          <div className="space-y-3 text-sm">
            <p className="text-dashboard-body">
              Use these exact details. Transfers are credited after Paystack confirms the deposit; your wallet updates
              after our servers verify it.
            </p>
            <div className="rounded-xl border border-dashboard-border bg-dashboard-bg/80 p-3">
              <p className="text-xs text-dashboard-muted">Bank</p>
              <p className="font-medium text-dashboard-heading">{virtualAccount.data.bankName}</p>
              <p className="mt-2 text-xs text-dashboard-muted">Account number</p>
              <p className="font-mono font-semibold text-dashboard-heading">{virtualAccount.data.accountNumber}</p>
              <p className="mt-2 text-xs text-dashboard-muted">Account name</p>
              <p className="font-medium text-dashboard-heading">{virtualAccount.data.accountName}</p>
            </div>
            <button
              type="button"
              className="rounded-lg border border-dashboard-border px-3 py-2 text-xs text-dashboard-heading"
              onClick={() => {
                if (virtualAccount.data?.accountNumber) {
                  void navigator.clipboard.writeText(virtualAccount.data.accountNumber);
                }
              }}
            >
              Copy account number
            </button>
          </div>
        ) : virtualAccount.data?.status === 'PENDING' ? (
          <p className="text-sm text-dashboard-body">Your dedicated account is being prepared.</p>
        ) : virtualAccount.data?.status === 'REQUIRES_RETRY' || virtualAccount.data?.status === 'FAILED' ? (
          <div className="space-y-2 text-sm">
            <p className="text-dashboard-body">
              {virtualAccount.data.message ?? 'Dedicated account provisioning failed. Retry or contact support.'}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => retryProvisioning.mutate()}
                disabled={retryProvisioning.isPending}
                className="rounded-lg bg-cohold-blue px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                {retryProvisioning.isPending ? 'Retrying…' : 'Retry provisioning'}
              </button>
              <Link href="/dashboard/support" className="rounded-lg border border-dashboard-border px-3 py-2 text-xs">
                Contact support
              </Link>
            </div>
          </div>
        ) : virtualAccount.data?.status === 'UNAVAILABLE' ? (
          <p className="text-sm text-dashboard-body">Bank transfer funding is currently unavailable.</p>
        ) : (
          <p className="text-sm text-dashboard-body">
            We could not determine your dedicated account status. Refresh this page or contact support.
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
