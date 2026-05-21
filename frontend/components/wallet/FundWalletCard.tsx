'use client';

import { useState } from 'react';
import { useInitializeWalletPayment } from '@/lib/hooks/use-wallet';
import { mapFinancialIntegrityError } from '@/lib/finance/financial-errors';
import {
  normalizeAmountNairaInput,
  walletFundingAmountError,
} from '@/lib/wallet/normalize-amount-naira';

export function FundWalletCard() {
  const [amount, setAmount] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const initPayment = useInitializeWalletPayment();

  const handlePaySecurely = async () => {
    const amountNaira = normalizeAmountNairaInput(amount);
    const validationError = walletFundingAmountError(amountNaira);
    if (validationError) {
      setFieldError(validationError);
      return;
    }
    setFieldError(null);
    const res = await initPayment.mutateAsync({ amountNaira });
    if (res.reference) window.sessionStorage.setItem('walletFundingReference', res.reference);
    if (res.checkoutUrl) window.location.href = res.checkoutUrl;
  };

  return (
    <div className="rounded-2xl border border-dashboard-border bg-dashboard-card p-4 shadow-[var(--home-card-shadow)]">
      <h2 className="text-sm font-semibold text-dashboard-heading mb-3">Pay securely</h2>
      <p className="text-xs text-dashboard-body mb-3 leading-relaxed">
        Card, bank transfer, USSD, and other Paystack-supported channels. Your wallet updates after Paystack confirms
        payment and our servers verify it — not when you click below or from redirect alone.
      </p>
      <label className="text-xs font-medium text-dashboard-body block mb-1">Amount (₦)</label>
      <input
        type="text"
        inputMode="decimal"
        placeholder="1,500.50"
        value={amount}
        onChange={(e) => {
          setAmount(e.target.value);
          if (fieldError) setFieldError(null);
        }}
        className="w-full rounded-xl border border-dashboard-border bg-white px-3 py-2.5 text-dashboard-heading placeholder:text-dashboard-muted mb-1"
        aria-invalid={fieldError ? true : undefined}
      />
      {fieldError ? (
        <p className="mb-2 text-xs text-red-600" role="alert">
          {fieldError}
        </p>
      ) : (
        <p className="mb-3 text-[11px] text-dashboard-muted">Enter amount in Naira only. Minimum ₦100.</p>
      )}
      <button
        type="button"
        onClick={handlePaySecurely}
        disabled={initPayment.isPending || !normalizeAmountNairaInput(amount)}
        className="w-full rounded-xl bg-cohold-blue py-3 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {initPayment.isPending ? 'Redirecting…' : 'Continue to checkout'}
      </button>
      {initPayment.isError ? (
        <p className="mt-2 text-xs text-red-600" role="alert">
          {mapFinancialIntegrityError(initPayment.error, 'Could not start checkout. Your balance was not changed.')}
        </p>
      ) : null}
    </div>
  );
}
