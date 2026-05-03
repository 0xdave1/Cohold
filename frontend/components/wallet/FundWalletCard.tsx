'use client';

import { useState } from 'react';
import Decimal from 'decimal.js';
import { useInitializeWalletPayment } from '@/lib/hooks/use-wallet';
import { mapFinancialIntegrityError } from '@/lib/finance/financial-errors';

/**
 * Issue 1: Funding only via `POST /payments/flutterwave/initialize` → hosted checkout →
 * server verify. No local balance mutation; balance refreshes after verified return + verify call.
 */
export function FundWalletCard() {
  const [amount, setAmount] = useState('');
  const initPayment = useInitializeWalletPayment();

  const handleFundWithFlutterwave = async () => {
    const clean = amount.replace(/,/g, '').trim();
    let amt: Decimal;
    try {
      amt = new Decimal(clean || '0');
    } catch {
      return;
    }
    if (!clean || amt.lte(0)) return;
    const res = await initPayment.mutateAsync({ amount: clean, currency: 'NGN' });
    if (res.reference) {
      window.sessionStorage.setItem('walletFundingReference', res.reference);
    }
    if (res.checkoutUrl) {
      window.location.href = res.checkoutUrl;
    }
  };

  return (
    <div className="rounded-2xl border border-dashboard-border bg-dashboard-card p-4 shadow-[var(--home-card-shadow)]">
      <h2 className="text-sm font-semibold text-dashboard-heading mb-3">Fund wallet (Flutterwave)</h2>
      <p className="text-xs text-dashboard-body mb-3 leading-relaxed">
        Wallet funding runs only through secure Flutterwave checkout. Your NGN balance updates only after the server verifies funds — not when you click below and not from redirect alone.
      </p>
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
        onClick={handleFundWithFlutterwave}
        disabled={initPayment.isPending || !amount.replace(/,/g, '').trim()}
        className="w-full rounded-xl bg-cohold-blue py-3 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {initPayment.isPending ? 'Redirecting…' : 'Fund Wallet'}
      </button>
      {initPayment.isError && (
        <p className="mt-2 text-xs text-red-600" role="alert">
          {mapFinancialIntegrityError(initPayment.error, 'Could not start checkout. Your balance was not changed.')}
        </p>
      )}
    </div>
  );
}
