'use client';

import { useState } from 'react';
import { useInitializeWalletPayment } from '@/lib/hooks/use-wallet';

/**
 * Card funding: initializes Paystack checkout and redirects to authorization_url.
 */
export function FundWalletCard() {
  const [amount, setAmount] = useState('');
  const initPayment = useInitializeWalletPayment();

  const handlePayWithCard = async () => {
    const clean = amount.replace(/,/g, '').trim();
    if (!clean || Number(clean) <= 0) return;
    const res = await initPayment.mutateAsync({ amount: clean, currency: 'NGN' });
    if (res.authorizationUrl) {
      window.location.href = res.authorizationUrl;
    }
  };

  return (
    <div className="rounded-2xl border border-dashboard-border bg-dashboard-card p-4 shadow-[var(--home-card-shadow)]">
      <h2 className="text-sm font-semibold text-dashboard-heading mb-3">Fund wallet (card)</h2>
      <label className="text-xs font-medium text-dashboard-body block mb-1">Amount (NGN)</label>
      <input
        type="text"
        inputMode="decimal"
        placeholder="0.00"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="w-full rounded-xl border border-dashboard-border bg-white px-3 py-2.5 text-dashboard-heading placeholder:text-dashboard-muted mb-3"
      />
      <button
        type="button"
        onClick={handlePayWithCard}
        disabled={initPayment.isPending || !amount.replace(/,/g, '').trim()}
        className="w-full rounded-xl bg-cohold-blue py-3 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {initPayment.isPending ? 'Redirecting…' : 'Pay with Card'}
      </button>
      {initPayment.isError && (
        
        <p className="mt-2 text-xs text-red-600">
          {initPayment.error instanceof Error ? initPayment.error.message : 'Payment init failed'}
        </p>
      )}
    </div>
  );
}
