'use client';

import Link from 'next/link';

export default function TopUpPage() {
  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center gap-3">
        <button onClick={() => window.history.back()}>
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold">Fund Wallet</h1>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 space-y-4">
        <p className="text-sm text-slate-400">
          Bank transfer via virtual account is currently unavailable. Fund your wallet with Flutterwave checkout.
        </p>
        <Link
          href="/dashboard/wallet"
          className="inline-flex w-full items-center justify-center rounded-lg bg-blue-500 py-3 font-medium text-white"
        >
          Fund Wallet with Flutterwave
        </Link>
      </div>
    </div>
  );
}
