'use client';

import Decimal from 'decimal.js';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  projectedAnnualReturn,
} from '@/lib/finance/investment-math';
import { buyPreviewFromAmount, buyPreviewFromShares } from '@/lib/money/buy-preview';
import { INVESTMENT_FEE_RATE } from '@/lib/constants/investment';
import { formatMoney } from '@/lib/hooks/use-wallet';

export type InvestmentCalculatorMode = 'shares' | 'amount';

export interface InvestmentCalculatorProps {
  propertyId: string;
  sharePrice: string;
  minInvestment: string;
  currency: string;
  walletBalance: string;
  /** Unitless annual yield from property API (e.g. 0.125). If absent, projected return row is hidden. */
  annualYield?: string | null;
  onConfirm: (shares: string) => void | Promise<void>;
  isSubmitting: boolean;
  disabled?: boolean;
}

const feePercentLabel = `${INVESTMENT_FEE_RATE * 100}%`;

export function InvestmentCalculator({
  sharePrice,
  minInvestment,
  currency,
  walletBalance,
  annualYield,
  onConfirm,
  isSubmitting,
  disabled = false,
}: InvestmentCalculatorProps) {
  const [mode, setMode] = useState<InvestmentCalculatorMode>('shares');
  const [sharesInput, setSharesInput] = useState('1');
  const [amountInput, setAmountInput] = useState('');

  const sp = useMemo(() => new Decimal(sharePrice || '0'), [sharePrice]);
  const bal = useMemo(() => new Decimal(walletBalance || '0'), [walletBalance]);
  const minInv = useMemo(() => new Decimal(minInvestment || '0'), [minInvestment]);

  const minShares = useMemo(() => {
    if (sp.lte(0)) return new Decimal(1);
    return minInv.div(sp).ceil();
  }, [sp, minInv]);

  /** Unified buy preview — same rules as backend (floor shares for amount mode). */
  const preview = useMemo(() => {
    if (sp.lte(0)) return null;
    if (mode === 'amount') {
      const raw = amountInput.replace(/[^\d]/g, '');
      if (!raw || new Decimal(raw).lte(0)) return null;
      return buyPreviewFromAmount(sharePrice, raw);
    }
    const raw = sharesInput.replace(/[^\d]/g, '');
    if (!raw) return null;
    const sh = new Decimal(raw);
    if (!sh.isInteger() || sh.lte(0)) return null;
    return buyPreviewFromShares(sharePrice, raw);
  }, [mode, amountInput, sharesInput, sharePrice, sp]);

  const principal = useMemo(() => {
    if (!preview) return null;
    return new Decimal(preview.principal);
  }, [preview]);

  const fee = useMemo(() => {
    if (!preview) return null;
    return new Decimal(preview.fee);
  }, [preview]);

  const total = useMemo(() => {
    if (!preview) return null;
    return new Decimal(preview.totalCharge);
  }, [preview]);

  const effectiveShares = useMemo(() => {
    if (!preview) return null;
    const s = new Decimal(preview.shares);
    if (!s.isInteger() || s.lte(0)) return null;
    return s;
  }, [preview]);

  const projected = useMemo(() => {
    if (!principal || annualYield == null || String(annualYield).trim() === '') {
      return null;
    }
    const p = projectedAnnualReturn(principal, annualYield);
    return p.gt(0) ? p : null;
  }, [principal, annualYield]);

  const belowMinShares = effectiveShares != null && effectiveShares.lt(minShares);
  const insufficient =
    total != null && !belowMinShares && total.gt(bal);

  const sharesInvalid = preview === null || effectiveShares === null;
  const totalInvalid = total === null || total.lte(0);

  const canSubmit =
    !sharesInvalid &&
    !totalInvalid &&
    !belowMinShares &&
    !insufficient &&
    !isSubmitting &&
    !disabled;

  return (
    <div className="rounded-2xl border border-dashboard-border bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-cohold-navy">Investment calculator</h3>
      <p className="mt-1 text-xs text-dashboard-body">
        Whole shares only. Fee ({feePercentLabel}) is on top of principal — same as checkout.
      </p>

      <p className="mt-3 rounded-lg bg-[#f8f6f1] px-3 py-2 text-sm font-semibold text-cohold-navy">
        1 share = {formatMoney(sharePrice, currency)}
      </p>

      <div className="mt-4 flex rounded-full border border-dashboard-border p-0.5 bg-[#fafafa]">
        <button
          type="button"
          disabled={disabled || isSubmitting}
          onClick={() => setMode('shares')}
          className={`flex-1 rounded-full py-2 text-xs font-medium transition-colors ${
            mode === 'shares' ? 'bg-cohold-navy text-white shadow-sm' : 'text-dashboard-body hover:bg-white/80'
          }`}
        >
          Shares
        </button>
        <button
          type="button"
          disabled={disabled || isSubmitting}
          onClick={() => setMode('amount')}
          className={`flex-1 rounded-full py-2 text-xs font-medium transition-colors ${
            mode === 'amount' ? 'bg-cohold-navy text-white shadow-sm' : 'text-dashboard-body hover:bg-white/80'
          }`}
        >
          Amount
        </button>
      </div>

      {mode === 'shares' ? (
        <>
          <label className="mt-4 block text-xs font-medium text-dashboard-heading" htmlFor="shares-input">
            Number of shares
          </label>
          <input
            id="shares-input"
            inputMode="numeric"
            value={sharesInput}
            disabled={disabled || isSubmitting}
            onChange={(e) => setSharesInput(e.target.value.replace(/\D/g, '') || '')}
            placeholder="1"
            className="mt-1 w-full rounded-xl border border-dashboard-border px-3 py-2.5 text-lg font-semibold text-cohold-navy outline-none focus:ring-2 focus:ring-cohold-gold/40 disabled:opacity-50"
          />
        </>
      ) : (
        <>
          <label className="mt-4 block text-xs font-medium text-dashboard-heading" htmlFor="amount-input">
            Amount ({currency}) — principal toward shares
          </label>
          <input
            id="amount-input"
            inputMode="numeric"
            value={amountInput}
            disabled={disabled || isSubmitting}
            onChange={(e) => setAmountInput(e.target.value.replace(/\D/g, '') || '')}
            placeholder="0"
            className="mt-1 w-full rounded-xl border border-dashboard-border px-3 py-2.5 text-lg font-semibold text-cohold-navy outline-none focus:ring-2 focus:ring-cohold-gold/40 disabled:opacity-50"
          />
          {preview && effectiveShares != null ? (
            <p className="mt-1 text-[11px] text-dashboard-muted">
              → {effectiveShares.toFixed(0)} whole shares (rounded down from amount)
            </p>
          ) : null}
        </>
      )}

      <p className="mt-2 text-[11px] text-dashboard-muted">
        Minimum: {minShares.toFixed(0)} shares ({formatMoney(minInvestment, currency)} min. investment)
      </p>

      {belowMinShares && effectiveShares != null && (
        <p className="mt-2 text-xs font-medium text-amber-800">
          Increase to at least {minShares.toFixed(0)} shares to meet the minimum investment.
        </p>
      )}

      {!belowMinShares && insufficient && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <p className="font-medium">Insufficient wallet balance for this purchase.</p>
          <Link href="/dashboard/wallet" className="mt-1 inline-block font-semibold text-cohold-navy underline">
            Fund wallet
          </Link>
        </div>
      )}

      <div className="mt-4 space-y-3 rounded-xl bg-[#f8f6f1] p-3 text-sm">
        <p className="text-center text-base font-bold text-cohold-navy">
          You will be charged: {total ? formatMoney(total.toFixed(), currency) : '—'}
        </p>

        <dl className="space-y-2 border-t border-dashboard-border/60 pt-3">
          <div className="flex justify-between gap-2">
            <dt className="text-dashboard-body">Principal</dt>
            <dd className="font-medium text-cohold-navy">
              {principal ? formatMoney(principal.toFixed(), currency) : '—'}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-dashboard-body/90 text-xs">
              Investment fee ({feePercentLabel})
            </dt>
            <dd className="text-xs font-medium text-dashboard-body">
              {fee ? formatMoney(fee.toFixed(), currency) : '—'}
            </dd>
          </div>
          <div className="flex justify-between gap-2 border-t border-dashboard-border pt-2">
            <dt className="font-semibold text-cohold-navy">Total charge</dt>
            <dd className="font-bold text-cohold-navy">
              {total ? formatMoney(total.toFixed(), currency) : '—'}
            </dd>
          </div>
          {projected != null && (
            <div className="flex justify-between gap-2 pt-1">
              <dt className="text-cohold-success text-xs">Estimated annual return (target yield)</dt>
              <dd className="text-sm font-medium text-cohold-success">
                {formatMoney(projected.toFixed(), currency)}
              </dd>
            </div>
          )}
          <div className="flex justify-between gap-2 border-t border-dashboard-border pt-2 text-xs">
            <dt className="text-dashboard-muted">Wallet available</dt>
            <dd className="font-medium text-dashboard-heading">{formatMoney(walletBalance, currency)}</dd>
          </div>
        </dl>
      </div>

      <button
        type="button"
        disabled={!canSubmit}
        onClick={() => effectiveShares && onConfirm(effectiveShares.toFixed(0))}
        className="mt-4 w-full rounded-xl bg-cohold-navy py-3 text-sm font-semibold text-white shadow transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isSubmitting ? 'Processing…' : 'Confirm investment'}
      </button>
      <p className="mt-2 text-center text-[10px] leading-relaxed text-dashboard-muted">
        Your funds will be securely held in escrow. You&apos;ll receive a transaction receipt instantly.
      </p>
    </div>
  );
}
