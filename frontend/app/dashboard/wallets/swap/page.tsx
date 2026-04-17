'use client';

import { useRouter } from 'next/navigation';

export default function SwapPage() {
  const router = useRouter();

  return (
    <div className="space-y-6 pb-20 max-w-md mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()}>
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold text-dashboard-heading">Swap</h1>
      </div>

      <div className="rounded-2xl border border-dashboard-border bg-dashboard-card p-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-dashboard-border/60">
          <svg className="h-7 w-7 text-dashboard-body" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v6h6M20 20v-6h-6M5 19l4-4M19 5l-4 4" />
          </svg>
        </div>
        <h2 className="mt-4 text-lg font-semibold text-dashboard-heading">Swap coming soon</h2>
        <p className="mt-2 text-sm text-dashboard-body">
          Wallet swap is currently unavailable while Cohold supports NGN-only operations.
        </p>
        <p className="mt-1 text-xs text-dashboard-body/80">
          You can still top up, withdraw, and send P2P transfers in NGN.
        </p>
      </div>

      <button
        onClick={() => router.push('/dashboard/wallets')}
        className="w-full rounded-xl bg-cohold-blue py-3 text-sm font-semibold text-white"
      >
        Back to wallet actions
      </button>
    </div>
  );
}
