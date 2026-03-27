'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWalletBalances, useWalletSwap, formatMoney } from '@/lib/hooks/use-wallet';
import Decimal from 'decimal.js';

export default function SwapPage() {
  const router = useRouter();
  const { data: _bData } = useWalletBalances();
  void _bData;
  const swapMutation = useWalletSwap();
  
  const [fromCurrency, setFromCurrency] = useState<'NGN' | 'USD' | 'GBP' | 'EUR'>('NGN');
  const [toCurrency, setToCurrency] = useState<'NGN' | 'USD' | 'GBP' | 'EUR'>('USD');
  const [amount, setAmount] = useState('10000000');
  const [showSummary, setShowSummary] = useState(false);

  
  // TODO: Get real FX rate from backend
  const fxRate = 0.001; // Placeholder: 1 NGN = 0.001 USD
  const toAmount = amount ? new Decimal(amount).mul(fxRate).toFixed(2) : '0';
  const fee = fromCurrency === 'NGN' || toCurrency === 'NGN' ? new Decimal('100') : new Decimal('0');
  const totalDebit = amount ? new Decimal(amount).plus(fee) : new Decimal('0');

  const handleSwap = async () => {
    if (!amount || new Decimal(amount).lte(0)) return;
    
    const res = await swapMutation.mutateAsync({
      fromCurrency,
      toCurrency,
      amount,
    });
    
    if (res.success) {
      router.push('/dashboard/wallets/swap/success');
    }
  };

  if (showSummary) {
    return (
      <div className="space-y-6 pb-20">
        <div className="flex items-center gap-3">
          <button onClick={() => setShowSummary(false)}>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold">Swap summary</h1>
        </div>

        <p className="text-sm text-slate-400">Ensure everything is correct</p>

        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 space-y-4">
          <div className="flex justify-between">
            <span className="text-slate-400">Amount to send</span>
            <span className="font-medium">{formatMoney(amount, fromCurrency)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Amount to receive</span>
            <span className="font-medium">{formatMoney(toAmount, toCurrency)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Conversion fee</span>
            <span className="font-medium">{formatMoney(fee.toString(), 'NGN')}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Exchange rate</span>
            <span className="font-medium">1 {fromCurrency} = {fxRate.toFixed(6)} {toCurrency}</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setShowSummary(false)}
            className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 font-medium"
          >
            Go back
          </button>
          <button
            onClick={handleSwap}
            disabled={swapMutation.isPending}
            className="flex-1 rounded-lg bg-blue-500 text-white px-4 py-3 font-medium disabled:opacity-50"
          >
            {swapMutation.isPending ? 'Swapping...' : 'Swap'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()}>
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold">Swap</h1>
      </div>

      <p className="text-sm text-slate-400">Enter amount and select currency to convert to.</p>

      {/* Amount to Convert */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 space-y-4">
        <div>
          <label className="text-sm text-slate-400 mb-2 block">Amount to convert</label>
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
              value={fromCurrency}
              onChange={(e) => setFromCurrency(e.target.value as any)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
            >
              <option value="NGN">NGN</option>
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
        </div>

        <div className="space-y-2 text-xs text-slate-400">
          <div className="flex justify-between">
            <span>Conversion fee</span>
            <span>{formatMoney(fee.toString(), 'NGN')}</span>
          </div>
          <div className="flex justify-between">
            <span>Amount we will convert</span>
            <span>{formatMoney(amount, fromCurrency)}</span>
          </div>
          <div className="flex justify-between">
            <span>Precharge/limit</span>
            <span>{formatMoney(totalDebit.toString(), fromCurrency)}</span>
          </div>
        </div>
      </div>

      {/* Amount You'll Receive */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 space-y-4">
        <div>
          <label className="text-sm text-slate-400 mb-2 block">Amount you&apos;ll receive</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={toAmount}
              readOnly
              className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
            />
            <select
              value={toCurrency}
              onChange={(e) => setToCurrency(e.target.value as any)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
            >
              <option value="NGN">NGN</option>
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
        </div>
      </div>

      <button
        onClick={() => setShowSummary(true)}
        disabled={!amount || new Decimal(amount).lte(0) || fromCurrency === toCurrency}
        className="w-full rounded-lg bg-blue-500 text-white py-3 font-medium disabled:opacity-50"
      >
        Continue
      </button>
    </div>
  );
}
