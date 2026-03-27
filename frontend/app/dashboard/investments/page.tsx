'use client';

import { useMemo, useState } from 'react';
import { useMyInvestments } from '@/lib/hooks/use-investments';
import { formatMoney } from '@/lib/hooks/use-wallet';
import { detectListingMode } from '@/lib/listings/category';
import {
  sumActivePortfolioValue,
  sumActiveShares,
  countActiveAssets,
  investmentPositionValue,
  isActiveInvestmentStatus,
} from '@/lib/money/portfolio';
import Link from 'next/link';

type ListingTab = 'all' | 'fractional' | 'land' | 'own-home';

export default function InvestmentsPage() {
  const [balanceCurrency, setBalanceCurrency] = useState<'NGN' | 'USD' | 'GBP' | 'EUR'>('NGN');
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [tab, setTab] = useState<ListingTab>('all');

  const { data: investmentsData, isLoading } = useMyInvestments(1, 100);
  /** COMPLETED / CANCELLED excluded from portfolio UI */
  const items = useMemo(
    () => (investmentsData?.items ?? []).filter((i) => isActiveInvestmentStatus(i.status)),
    [investmentsData?.items],
  );

  /** Principal + ROI credited — not liquid wallet cash. */
  const investmentBalanceRaw = useMemo(() => {
    return sumActivePortfolioValue(items, balanceCurrency);
  }, [items, balanceCurrency]);

  const totalSharesRaw = useMemo(() => sumActiveShares(items, balanceCurrency), [items, balanceCurrency]);

  const numberOfAssets = useMemo(() => countActiveAssets(items, balanceCurrency), [items, balanceCurrency]);

  const investmentBalance = formatMoney(investmentBalanceRaw, balanceCurrency);

  const filteredItems = useMemo(() => {
    if (tab === 'all') return items;
    return items.filter(
      (inv) => detectListingMode(inv.property.title, inv.property.description) === tab,
    );
  }, [items, tab]);

  const counts = useMemo(() => {
    return {
      all: items.length,
      fractional: items.filter((i) => detectListingMode(i.property.title, i.property.description) === 'fractional')
        .length,
      land: items.filter((i) => detectListingMode(i.property.title, i.property.description) === 'land').length,
      ownHome: items.filter((i) => detectListingMode(i.property.title, i.property.description) === 'own-home')
        .length,
    };
  }, [items]);

  const maskedBalance = (() => {
    const m = investmentBalance.match(/^(\D+)\s*(.+)$/);
    if (!m) return '••••••';
    return `${m[1]}•••••`;
  })();

  return (
    <div className="space-y-6 pb-20">
      <div>
        <h1 className="text-xl font-semibold">Investments</h1>
        <p className="text-sm text-slate-400">View my investment portfolio</p>
      </div>

      {/* Investment balance card (Figma) — balance = sum of active investments in selected currency */}
      <div className="mx-auto w-full max-w-md rounded-2xl bg-dashboard-card border border-dashboard-border p-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
        <p className="text-xs text-dashboard-body mb-1 text-center">
          Investment portfolio ({balanceCurrency})
        </p>
        <p className="text-[10px] text-dashboard-body/80 mb-3 text-center">
          Principal + returns · {numberOfAssets} {numberOfAssets === 1 ? 'asset' : 'assets'} ·{' '}
          {Number(totalSharesRaw).toLocaleString(undefined, { maximumFractionDigits: 4 })} shares
        </p>

        <div className="flex flex-col items-center">
          <div className="relative">
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-emerald-100 flex items-center justify-center">
              {balanceCurrency === 'NGN' ? (
                <svg className="h-3 w-3 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 10h8" />
                  <path d="M8 14h8" />
                  <path d="M12 6v12" />
                </svg>
              ) : (
                <span className="h-2 w-2 rounded-full bg-emerald-600" />
              )}
            </div>

            <select
              value={balanceCurrency}
              onChange={(e) => setBalanceCurrency(e.target.value as 'NGN' | 'USD' | 'GBP' | 'EUR')}
              className="appearance-none rounded-full border border-dashboard-border bg-white px-10 py-1.5 text-sm font-medium text-dashboard-heading pr-9"
              aria-label="Currency account"
            >
              <option value="NGN">NGN Account</option>
              <option value="USD">USD Account</option>
              <option value="GBP">GBP Account</option>
              <option value="EUR">EUR Account</option>
            </select>

            <svg
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dashboard-body"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          <div className="mt-4 flex items-center justify-center gap-3">
            {isLoading ? (
              <div className="h-7 w-20 rounded bg-dashboard-border/50 animate-pulse" />
            ) : (
              <p className="text-2xl font-bold text-dashboard-heading">{balanceVisible ? investmentBalance : maskedBalance}</p>
            )}

            <button
              type="button"
              onClick={() => setBalanceVisible((v) => !v)}
              className="p-1 rounded-full hover:bg-dashboard-border/40"
              aria-label={balanceVisible ? 'Hide balance' : 'Show balance'}
            >
              {balanceVisible ? (
                <svg className="h-5 w-5 text-dashboard-body" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              ) : (
                <svg className="h-5 w-5 text-dashboard-body" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.88 9.88l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {!isLoading && items.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(
            [
              { key: 'all' as const, label: 'All assets', count: counts.all },
              { key: 'fractional' as const, label: 'Fractional', count: counts.fractional },
              { key: 'land' as const, label: 'Land', count: counts.land },
              { key: 'own-home' as const, label: 'Own a home', count: counts.ownHome },
            ] as const
          ).map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs border transition-colors ${
                  active
                    ? 'bg-[#F5D99A] text-dashboard-heading border-[#E7C97E]'
                    : 'bg-dashboard-card text-dashboard-body border-dashboard-border'
                }`}
              >
                {t.label} ({t.count})
              </button>
            );
          })}
        </div>
      )}

      {isLoading ? (
        <div className="rounded-2xl border border-dashboard-border bg-dashboard-card p-8 animate-pulse h-64" />
      ) : items.length === 0 ? (
        <div className="mx-auto w-full max-w-md pt-6">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl border border-[#E7C97E] bg-[#F5D99A]">
            <svg className="h-10 w-10 text-dashboard-heading" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 21h18" />
              <path d="M4 21V11l8-6 8 6v10" />
              <path d="M9 21V15h6v6" />
              <path d="M9 13h6" />
            </svg>
          </div>

          <p className="mx-auto mt-5 w-[270px] text-center text-xs font-normal leading-5 text-dashboard-body">
            You do not have any investment yet. Click on the
            button below to find properties you can invest in,
            lands you can buy and homes you can own.
          </p>

          <Link
            href="/dashboard/properties"
            className="mx-auto mt-6 block w-[220px] rounded-full bg-cohold-blue py-3 text-center text-sm font-semibold text-white hover:opacity-90"
          >
            Go to Listings
          </Link>
        </div>
      ) : filteredItems.length === 0 ? (
        <p className="text-center text-sm text-dashboard-body">No investments in this category.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filteredItems.map((investment) => {
            const mode = detectListingMode(investment.property.title, investment.property.description);
            const badge =
              mode === 'land' ? 'Land' : mode === 'own-home' ? 'Own a home' : 'Fractional';
            return (
              <Link
                key={investment.id}
                href={`/dashboard/portfolio/${investment.id}`}
                className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden hover:bg-slate-900/60 transition-colors"
              >
                <div className="h-32 bg-slate-700 relative">
                  <div className="absolute top-2 left-2">
                    <span className="rounded bg-blue-600/90 text-white text-[9px] px-1.5 py-0.5">{badge}</span>
                  </div>
                </div>
                <div className="p-3">
                  <p className="text-xs font-medium mb-1 line-clamp-2">{investment.property.title}</p>
                  <p className="text-[10px] text-slate-500 mb-1 line-clamp-1">
                    {investment.property.location}
                  </p>
                  {mode === 'fractional' ? (
                    <>
                      <p className="text-xs text-slate-400">
                        Position value:{' '}
                        <span className="font-medium text-slate-200">
                          {formatMoney(
                            investmentPositionValue(investment.amount, investment.totalReturns),
                            investment.currency,
                          )}
                        </span>
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Returns:{' '}
                        <span className="font-medium text-emerald-400/90">
                          {formatMoney(investment.totalReturns ?? '0', investment.currency)}
                        </span>
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Shares:{' '}
                        <span className="font-medium text-slate-200">{investment.shares}</span>
                      </p>
                    </>
                  ) : mode === 'land' ? (
                    <p className="text-xs text-slate-400">
                      Amount invested:{' '}
                      <span className="font-medium text-slate-200">
                        {formatMoney(investment.amount, investment.currency)}
                      </span>
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400">
                      Amount invested:{' '}
                      <span className="font-medium text-slate-200">
                        {formatMoney(investment.amount, investment.currency)}
                      </span>
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
