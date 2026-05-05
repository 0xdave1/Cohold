'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import Decimal from 'decimal.js';
import { usePropertyDetails } from '@/lib/hooks/use-properties';
import { useMyInvestments } from '@/lib/hooks/use-investments';
import { useWalletBalances } from '@/lib/hooks/use-wallet';
import { formatMoney } from '@/lib/hooks/use-wallet';
import { buyPreviewFromAmount, buyPreviewFromShares } from '@/lib/money/buy-preview';
import { sumActivePortfolioValue } from '@/lib/money/portfolio';
import { INVESTMENT_FEE_RATE } from '@/lib/constants/investment';
import { BackIconButton, SectionCard } from '../../_components/listing-ui';
import { useMe } from '@/lib/hooks/use-onboarding';
import { isKycMoneyActionAllowed } from '@/lib/kyc/status';

const SUGGESTED_AMOUNTS = ['1000000', '2000000', '5000000', '10000000', '50000000', '100000000', '1000000000'] as const;

type InputMode = 'shares' | 'amount';

export default function InvestFractionPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const { data: property } = usePropertyDetails(id);
  const { data: myInvestments } = useMyInvestments(1, 100);
  const { data: walletBalances = [] } = useWalletBalances();
  const { data: me, isLoading: meLoading } = useMe();

  const initialAmount = searchParams.get('amount') ?? '';
  const initialShares = searchParams.get('shares') ?? '1';
  const initialMode = (searchParams.get('mode') === 'amount' ? 'amount' : 'shares') as InputMode;

  const [amount, setAmount] = useState(initialAmount);
  const [shares, setShares] = useState(initialShares);
  const [mode, setMode] = useState<InputMode>(initialMode);

  const sharePrice = property?.sharePrice ?? property?.totalValue ?? '0';
  const currency = property?.currency ?? 'NGN';

  const portfolioTotalStr = useMemo(() => {
    const items = myInvestments?.items ?? [];
    return sumActivePortfolioValue(items, currency);
  }, [myInvestments?.items, currency]);

  const walletForCurrency = walletBalances.find((w) => w.currency === currency);
  const walletLiquidStr = walletForCurrency?.balance ?? '0';

  const cleanedAmount = amount.replace(/,/g, '');

  const preview = useMemo(() => {
    if (!property) return null;
    if (mode === 'amount') {
      if (!cleanedAmount) return null;
      try {
        if (new Decimal(cleanedAmount).lte(0)) return null;
      } catch {
        return null;
      }
      return buyPreviewFromAmount(String(sharePrice), cleanedAmount);
    }
    const sh = shares.replace(/[^\d]/g, '') || '0';
    try {
      if (!sh || new Decimal(sh).lte(0)) return null;
    } catch {
      return null;
    }
    return buyPreviewFromShares(String(sharePrice), sh);
  }, [property, mode, cleanedAmount, shares, sharePrice]);

  const effectiveShares = preview?.shares ?? '0';

  const swapMode = () => {
    setMode((m) => (m === 'shares' ? 'amount' : 'shares'));
  };

  if (!property) return <div className="h-64 animate-pulse rounded-xl bg-dashboard-border/60" />;
  const kycAllowed = isKycMoneyActionAllowed(me?.kycStatus);

  const summaryQuery = preview
    ? `shares=${encodeURIComponent(effectiveShares)}&principal=${encodeURIComponent(preview.principal)}&fee=${encodeURIComponent(preview.fee)}&total=${encodeURIComponent(preview.totalCharge)}`
    : '';

  return (
    <div className="space-y-4">
      <BackIconButton href={`/dashboard/properties/${id}?mode=fractional`} />
      <div>
        <h1 className="text-xl font-semibold text-dashboard-heading">Buy</h1>
        <p className="text-xs text-dashboard-body">Enter shares or amount — fee is {INVESTMENT_FEE_RATE * 100}% on principal (on top).</p>
      </div>

      <div className="flex rounded-full border border-dashboard-border p-0.5 bg-dashboard-card">
        <button
          type="button"
          onClick={() => setMode('shares')}
          className={`flex-1 rounded-full py-2 text-xs font-medium transition-colors ${
            mode === 'shares' ? 'bg-cohold-blue text-white' : 'text-dashboard-body'
          }`}
        >
          Shares
        </button>
        <button
          type="button"
          onClick={() => setMode('amount')}
          className={`flex-1 rounded-full py-2 text-xs font-medium transition-colors ${
            mode === 'amount' ? 'bg-cohold-blue text-white' : 'text-dashboard-body'
          }`}
        >
          Amount
        </button>
      </div>

      <SectionCard title={mode === 'amount' ? 'Amount (principal target)' : 'Number of shares'}>
        <div className="space-y-2">
          {mode === 'amount' ? (
            <div className="flex items-center gap-2 rounded-lg border border-dashboard-border bg-white px-3 py-2">
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
                placeholder="1,000,000"
                className="w-full bg-transparent text-sm text-dashboard-heading outline-none"
                inputMode="numeric"
              />
              <span className="text-xs text-dashboard-body">{property.currency}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-dashboard-border bg-white px-3 py-2">
              <input
                value={shares}
                onChange={(e) => setShares(e.target.value.replace(/[^\d]/g, ''))}
                placeholder="1"
                className="w-full bg-transparent text-sm text-dashboard-heading outline-none"
                inputMode="numeric"
              />
              <span className="text-xs text-dashboard-body">Shares</span>
            </div>
          )}
          <div className="flex items-center justify-center py-0.5">
            <button
              type="button"
              onClick={swapMode}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-dashboard-border bg-dashboard-card"
              aria-label="Switch input mode"
            >
              <svg className="h-4 w-4 text-dashboard-body" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </button>
          </div>
          {mode === 'amount' ? (
            <p className="text-[11px] text-dashboard-body">
              Whole shares only — we round down: <span className="font-medium text-dashboard-heading">{effectiveShares}</span> shares
            </p>
          ) : null}

          <div className="rounded-lg bg-dashboard-border/20 px-3 py-2 space-y-1 text-[11px]">
            <div className="flex justify-between gap-2">
              <span className="text-dashboard-body">Investment portfolio ({currency})</span>
              <span className="font-medium text-dashboard-heading">{formatMoney(portfolioTotalStr, currency)}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-dashboard-body">Wallet available ({currency})</span>
              <span className="font-medium text-dashboard-heading">{formatMoney(walletLiquidStr, currency)}</span>
            </div>
          </div>
        </div>
      </SectionCard>

      {preview && (
        <SectionCard title="Charge preview">
          <div className="space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span className="text-dashboard-body">Principal</span>
              <span className="font-medium">{formatMoney(preview.principal, currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-dashboard-body">Fee ({INVESTMENT_FEE_RATE * 100}%)</span>
              <span>{formatMoney(preview.fee, currency)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-dashboard-border/60 font-semibold">
              <span>You will be charged</span>
              <span>{formatMoney(preview.totalCharge, currency)}</span>
            </div>
          </div>
        </SectionCard>
      )}

      <SectionCard title="Suggested amount">
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_AMOUNTS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => {
                setMode('amount');
                setAmount(v);
              }}
              className="rounded-md border border-dashboard-border px-3 py-1 text-xs text-dashboard-heading"
            >
              {v === '1000000000' && property.currency === 'NGN' ? '₦1B' : formatMoney(v, property.currency)}
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Suggested shares">
        <div className="flex flex-wrap gap-2">
          {['1', '2', '5', '10', '50', '100', '1000'].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => {
                setMode('shares');
                setShares(v);
              }}
              className="rounded-md border border-dashboard-border px-3 py-1 text-xs text-dashboard-heading"
            >
              {v} {Number(v) === 1 ? 'share' : 'shares'}
            </button>
          ))}
        </div>
      </SectionCard>

      {!preview || !effectiveShares || Number(effectiveShares) <= 0 || meLoading || !kycAllowed ? (
        <button type="button" disabled className="h-11 w-full rounded-full bg-cohold-blue px-4 text-sm font-medium text-white opacity-50">
          {meLoading ? 'Checking KYC…' : kycAllowed ? 'Buy shares now' : 'KYC verification required'}
        </button>
      ) : (
        <Link
          href={`/dashboard/properties/${id}/invest/summary?${summaryQuery}`}
          className="flex h-11 w-full items-center justify-center rounded-full bg-cohold-blue px-4 text-sm font-medium text-white"
        >
          Buy shares now
        </Link>
      )}
      {!meLoading && !kycAllowed ? (
        <Link href="/dashboard/kyc" className="block text-center text-xs font-medium text-cohold-blue underline">
          Complete KYC to invest
        </Link>
      ) : null}
    </div>
  );
}
