'use client';

import Link from 'next/link';
import { useKycStatus } from '@/lib/hooks/use-kyc';
import { useMyVirtualAccount, useRetryVirtualAccountProvisioning } from '@/lib/hooks/use-wallet';

/**
 * Wallet funding UX: only Flutterwave-backed checkout from `/dashboard/wallet`.
 * There is no manual funding, transfer simulation, or client-side balance minting.
 */
export default function TopUpPage() {
  const { data: kyc } = useKycStatus();
  const virtualAccount = useMyVirtualAccount();
  const retryProvisioning = useRetryVirtualAccountProvisioning();
  const isVerified = kyc?.status === 'VERIFIED';

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => window.history.back()} aria-label="Go back">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold">Fund wallet</h1>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-100">A) Bank transfer (virtual account)</h2>
        {!isVerified ? (
          <p className="text-sm text-slate-300">Complete KYC to unlock your dedicated bank-transfer account.</p>
        ) : virtualAccount.isLoading ? (
          <p className="text-sm text-slate-300">Loading transfer account status…</p>
        ) : virtualAccount.data?.status === 'ACTIVE' ? (
          <div className="space-y-1 text-sm text-slate-200">
            <p>Bank: {virtualAccount.data.bankName}</p>
            <p>Account number: {virtualAccount.data.accountNumber}</p>
            <p>Account name: {virtualAccount.data.accountName}</p>
            <p className="pt-2 text-xs text-slate-400">
              Transfers are credited after provider confirmation. Balance updates after server verification.
            </p>
          </div>
        ) : virtualAccount.data?.status === 'PENDING' ? (
          <p className="text-sm text-slate-300">Your bank transfer account is being prepared.</p>
        ) : virtualAccount.data?.status === 'FAILED' || virtualAccount.data?.status === 'REQUIRES_RETRY' ? (
          <div className="space-y-2">
            <p className="text-sm text-slate-300">{virtualAccount.data.message ?? 'Provisioning failed.'}</p>
            <button
              type="button"
              onClick={() => retryProvisioning.mutate()}
              disabled={retryProvisioning.isPending}
              className="rounded-lg border border-slate-500 px-3 py-2 text-xs text-slate-200"
            >
              {retryProvisioning.isPending ? 'Retrying…' : 'Retry provisioning'}
            </button>
          </div>
        ) : (
          <p className="text-sm text-slate-300">Bank transfer funding is currently unavailable.</p>
        )}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-100">B) Flutterwave checkout</h2>
        <p className="text-sm text-slate-300 leading-relaxed">
          Wallet funding is processed through secure Flutterwave checkout. Your balance updates only after payment is
          verified on our servers.
        </p>
        <Link
          href="/dashboard/wallet"
          className="inline-flex w-full items-center justify-center rounded-lg bg-blue-500 py-3 font-medium text-white"
        >
          Continue to Flutterwave funding
        </Link>
      </div>
    </div>
  );
}
