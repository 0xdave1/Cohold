'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Decimal from 'decimal.js';
import { useP2PStore } from '@/stores/p2p.store';
import { useWalletBalances } from '@/lib/hooks/use-wallet';

export default function P2PAmountPage() {
  const router = useRouter();
  const recipient = useP2PStore((s) => s.recipient);
  const currency = useP2PStore((s) => s.currency);
  const amount = useP2PStore((s) => s.amount);
  const setAmount = useP2PStore((s) => s.setAmount);

  const { data: wallets } = useWalletBalances();

  const walletBalanceForCurrency = useMemo(() => {
    if (!wallets) return null;
    return wallets.find((w) => w.currency === currency)?.balance ?? null;
  }, [wallets, currency]);

  const invalid = useMemo(() => {
    if (!amount) return true;
    try {
      return new Decimal(amount).lte(0);
    } catch {
      return true;
    }
  }, [amount]);

  if (!recipient) {
    router.replace('/dashboard/wallets/p2p');
    return null;
  }

  const avatar = (recipient.displayName?.[0] ?? recipient.username[0] ?? 'U').toUpperCase();

  return (
    <div className="space-y-6 pb-28 max-w-sm mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/dashboard/wallets/p2p')} aria-label="Back">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold text-dashboard-heading">P2P</h1>
      </div>

      <div className="flex items-center justify-between p-4 rounded-2xl border border-dashboard-border bg-dashboard-card">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-full bg-[#F5D99A] flex items-center justify-center text-cohold-blue font-semibold">
            {avatar}
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-dashboard-heading truncate">
              {recipient.displayName ?? `@${recipient.username}`}
            </div>
            <div className="text-xs text-dashboard-body truncate">@{recipient.username}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => router.push('/dashboard/wallets/p2p')}
          className="text-sm font-semibold text-cohold-link"
        >
          Change
        </button>
      </div>

      <div>
        <label className="text-xs font-medium text-dashboard-body mb-2 block">Amount to send</label>

        <div className="flex items-center rounded-xl border border-dashboard-border bg-white px-3 py-2.5">
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => {
              const val = e.target.value.replace(/[^0-9.]/g, '');
              if (val === '' || /^\d*\.?\d*$/.test(val)) {
                setAmount(val);
              }
            }}
            className="flex-1 bg-transparent outline-none text-sm text-dashboard-heading placeholder:text-dashboard-muted"
            placeholder="0.00"
          />

          <span className="ml-3 pl-3 border-l border-dashboard-border text-sm font-semibold text-dashboard-heading">
            NGN
          </span>
        </div>

        {walletBalanceForCurrency != null ? (
          <p className="mt-2 text-[11px] text-dashboard-muted">
            Wallet balance: {walletBalanceForCurrency} {currency}
          </p>
        ) : (
          <p className="mt-2 text-[11px] text-dashboard-muted">Wallet balance</p>
        )}
      </div>

      <div className="fixed bottom-16 left-0 right-0 z-40 pointer-events-none">
        <div className="mx-auto max-w-2xl px-4 pointer-events-auto">
          <button
            type="button"
            onClick={() => router.push('/dashboard/wallets/p2p/summary')}
            disabled={invalid}
            className="w-full rounded-xl bg-cohold-blue py-3 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

