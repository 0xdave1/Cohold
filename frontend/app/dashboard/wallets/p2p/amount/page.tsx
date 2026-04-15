'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Decimal from 'decimal.js';
import { useP2PStore } from '@/stores/p2p.store';

export default function P2PAmountPage() {
  const router = useRouter();
  const recipient = useP2PStore((s) => s.recipient);
  const currency = useP2PStore((s) => s.currency);
  const amount = useP2PStore((s) => s.amount);
  const setAmount = useP2PStore((s) => s.setAmount);
  const setCurrency = useP2PStore((s) => s.setCurrency);

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
    <div className="space-y-6 pb-20">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/dashboard/wallets/p2p')} aria-label="Back">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold">P2P</h1>
      </div>

      <div className="flex items-center justify-between p-4 rounded-xl border border-slate-800 bg-slate-900/40">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-orange-500 flex items-center justify-center text-white font-medium">
            {avatar}
          </div>
          <div>
            <div className="font-medium">{recipient.displayName ?? `@${recipient.username}`}</div>
            <div className="text-xs text-slate-400">@{recipient.username}</div>
          </div>
        </div>
        <button onClick={() => router.push('/dashboard/wallets/p2p')} className="text-sm text-blue-400">
          Change
        </button>
      </div>

      <div>
        <label className="text-sm text-slate-400 mb-2 block">Amount to send</label>
        <div className="flex items-center gap-2">
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
            className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
            placeholder="0.00"
          />
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as any)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
          >
            <option value="NGN">NGN</option>
            <option value="USD">USD</option>
            <option value="GBP">GBP</option>
            <option value="EUR">EUR</option>
          </select>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => router.push('/dashboard/wallets/p2p')}
          className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 font-medium"
        >
          Go back
        </button>
        <button
          onClick={() => router.push('/dashboard/wallets/p2p/summary')}
          disabled={invalid}
          className="flex-1 rounded-lg bg-blue-500 text-white px-4 py-3 font-medium disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}

