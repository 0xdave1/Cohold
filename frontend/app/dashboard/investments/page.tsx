'use client';

import { useMemo, useState } from 'react';
import { useMyInvestments } from '@/lib/hooks/use-investments';
import { formatMoney } from '@/lib/hooks/use-wallet';
import { useUserDistributionHistory } from '@/lib/hooks/use-distributions';
import { distributionStatusLabel, normalizeDistributionStatus } from '@/lib/distributions/status';
import { resolveListingMode } from '@/lib/listings/category';
import { CategoryPill, coholdUi, FilterChip, ListingSkeleton } from '../properties/_components/listing-ui';
import { formatAnnualYieldPercent } from '@/lib/format/yield';
import { formatTermForListingCard } from '@/lib/listings/format-term';
import { shortLocationForListingCard } from '@/lib/listings/display-location';
import {
  sumActivePortfolioValue,
  sumActiveShares,
  countActiveAssets,
  isActiveInvestmentStatus,
  formatSharesQuantityForDisplay,
} from '@/lib/money/portfolio';
import Link from 'next/link';

type ListingTab = 'all' | 'fractional' | 'land' | 'own-home';

export default function InvestmentsPage() {
  const [balanceCurrency] = useState<'NGN'>('NGN');
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [tab, setTab] = useState<ListingTab>('all');

  const { data: investmentsData, isLoading } = useMyInvestments(1, 100);
  const { data: distributionHistory } = useUserDistributionHistory(1, 8);
  /** COMPLETED / CANCELLED excluded from portfolio UI */
  const items = useMemo(
    () => (investmentsData?.items ?? []).filter((i) => isActiveInvestmentStatus(i.status)),
    [investmentsData?.items],
  );

  /** Principal + posted distribution credits — not liquid wallet cash. */
  const investmentBalanceRaw = useMemo(() => {
    return sumActivePortfolioValue(items, balanceCurrency);
  }, [items, balanceCurrency]);

  const totalSharesRaw = useMemo(() => sumActiveShares(items, balanceCurrency), [items, balanceCurrency]);

  const numberOfAssets = useMemo(() => countActiveAssets(items, balanceCurrency), [items, balanceCurrency]);

  const investmentBalance = formatMoney(investmentBalanceRaw, balanceCurrency);

  const filteredItems = useMemo(() => {
    if (tab === 'all') return items;
    return items.filter((inv) => resolveListingMode(inv.property) === tab);
  }, [items, tab]);

  const counts = useMemo(() => {
    return {
      all: items.length,
      fractional: items.filter((i) => resolveListingMode(i.property) === 'fractional').length,
      land: items.filter((i) => resolveListingMode(i.property) === 'land').length,
      ownHome: items.filter((i) => resolveListingMode(i.property) === 'own-home').length,
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
        <h1 className="text-xl font-semibold text-cohold-text">Investments</h1>
        <p className="text-sm text-cohold-muted">View my investment portfolio</p>
        <p className="mt-1 text-xs text-cohold-muted">
          Projected yield is an estimate. Paid income appears only after backend-posted distributions.
        </p>
      </div>

      {/* Investment balance card (Figma) — balance = sum of active investments in selected currency */}
      <div className="w-full rounded-2xl bg-dashboard-card border border-dashboard-border p-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
        <p className="text-xs text-dashboard-body mb-1 text-center">
          Investment portfolio ({balanceCurrency})
        </p>
        <p className="text-[10px] text-dashboard-body/80 mb-3 text-center">
          Principal + paid distributions · {numberOfAssets} {numberOfAssets === 1 ? 'asset' : 'assets'} ·{' '}
          {formatSharesQuantityForDisplay(totalSharesRaw)} shares
        </p>

        <div className="flex flex-col items-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-dashboard-border bg-white px-4 py-1.5 text-sm font-medium text-dashboard-heading">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100">
              <svg className="h-3 w-3 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 10h8" />
                <path d="M8 14h8" />
                <path d="M12 6v12" />
              </svg>
            </span>
            <span>NGN Account</span>
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
              <FilterChip key={t.key} active={active} onClick={() => setTab(t.key)}>
                {t.label} ({t.count})
              </FilterChip>
            );
          })}
        </div>
      )}

      {isLoading ? (
        <ListingSkeleton rows={2} />
      ) : items.length === 0 ? (
        <div className="w-full pt-6">
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
            const mode = resolveListingMode(investment.property);
            const meta =
              mode === 'fractional'
                ? [
                    shortLocationForListingCard(investment.property),
                    formatAnnualYieldPercent(investment.property.annualYield),
                    formatTermForListingCard(investment.property.termMonths),
                  ]
                    .filter(Boolean)
                    .join(' · ')
                : shortLocationForListingCard(investment.property) || investment.property.location;
            return (
              <Link key={investment.id} href={`/dashboard/portfolio/${investment.id}`} className={coholdUi.card}>
                <div className="relative h-28 bg-cohold-border/50">
                  <div className="absolute left-2 top-2">
                    <CategoryPill listingType={investment.property.listingType} mode={mode} />
                  </div>
                </div>
                <div className="p-3">
                  <p className="line-clamp-2 text-sm font-semibold text-cohold-text">{investment.property.title}</p>
                  {meta ? <p className="mt-1 line-clamp-1 text-[10px] text-cohold-muted">{meta}</p> : null}
                  <div className="mt-2 space-y-1">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-cohold-muted">Amount invested</span>
                      <span className="font-medium text-cohold-text">
                        {formatMoney(investment.amount, investment.currency)}
                      </span>
                    </div>
                    {mode === 'fractional' ? (
                      <div className="flex justify-between text-[10px]">
                        <span className="text-cohold-muted">No. of shares</span>
                        <span className="font-medium text-cohold-text">{investment.shares}</span>
                      </div>
                    ) : null}
                  </div>
                  <p className="mt-2 text-right text-xs font-medium text-cohold-primary">View →</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <div className="rounded-xl border border-dashboard-border bg-dashboard-card p-4">
        <p className="text-sm font-semibold text-dashboard-heading">Distribution history</p>
        <p className="text-xs text-dashboard-body mt-1">
          Distributions depend on realized property income and admin approval; they may be delayed, reduced, failed, or reversed.
        </p>
        <div className="mt-3 space-y-2">
          {(distributionHistory?.items ?? []).length === 0 ? (
            <p className="text-xs text-dashboard-body">No paid distributions yet.</p>
          ) : (
            (distributionHistory?.items ?? []).map((item) => {
              const status = normalizeDistributionStatus(item.status ?? item.batch?.status);
              return (
                <div key={item.id} className="rounded-lg border border-dashboard-border px-3 py-2">
                  <p className="text-xs text-dashboard-heading font-medium">
                    {formatMoney(item.amount, item.currency)} · {distributionStatusLabel(status)}
                  </p>
                  <p className="text-[11px] text-dashboard-body">
                    Property: {item.batch?.propertyId ?? '—'} · Period: {item.batch?.periodStart?.slice(0, 10) ?? '—'} to{' '}
                    {item.batch?.periodEnd?.slice(0, 10) ?? '—'}
                  </p>
                  {item.ledgerOperationId ? (
                    <p className="text-[10px] text-dashboard-muted">Ledger: {item.ledgerOperationId}</p>
                  ) : null}
                  {item.failureReason ? (
                    <p className="text-[11px] text-red-700">Reason: {item.failureReason}</p>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
