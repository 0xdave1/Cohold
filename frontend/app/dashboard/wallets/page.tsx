'use client';

import { useWalletBalances, formatMoney } from '@/lib/hooks/use-wallet';
import Link from 'next/link';

export default function WalletsPage() {
  const { data: balances, isLoading } = useWalletBalances();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Wallets</h1>
      {isLoading ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 animate-pulse h-24" />
      ) : (
        <div className="space-y-3">
          {balances?.map((w) => (
            <div
              key={w.id}
              className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 flex items-center justify-between"
            >
              <span className="font-medium">{w.currency} Account</span>
              <span className="text-slate-300">{formatMoney(w.balance, w.currency)}</span>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-3 flex-wrap">
        <Link href="/dashboard/wallet" className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium">
          Fund Wallet with Flutterwave
        </Link>
        <Link href="/dashboard/wallets/swap" className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium">
          Swap
        </Link>
        <Link href="/dashboard/wallets/p2p" className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium">
          P2P
        </Link>
      </div>
    </div>
  );
}
