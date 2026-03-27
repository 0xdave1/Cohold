'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { usePropertyDetails } from '@/lib/hooks/use-properties';
import { useMyInvestments } from '@/lib/hooks/use-investments';
import { formatMoney, useWalletBalances } from '@/lib/hooks/use-wallet';
import { sumActivePortfolioValue } from '@/lib/money/portfolio';
import { BackIconButton, SectionCard } from '../../_components/listing-ui';

export default function SellSharesPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const { data: property } = usePropertyDetails(id);
  const { data: myInvestments } = useMyInvestments(1, 100);
  const { data: walletBalances = [] } = useWalletBalances();

  const mine = useMemo(() => {
    const items = myInvestments?.items ?? [];
    return items.find((i) => i.propertyId === id && (i.status ?? 'ACTIVE') === 'ACTIVE');
  }, [myInvestments?.items, id]);

  const initialShares = searchParams.get('shares') ?? '';
  const [shares, setShares] = useState(initialShares);

  const portfolioStr = useMemo(() => {
    const items = myInvestments?.items ?? [];
    return sumActivePortfolioValue(items, property?.currency ?? 'NGN');
  }, [myInvestments?.items, property?.currency]);

  const walletLiquidStr = useMemo(() => {
    const w = walletBalances.find((x) => x.currency === (property?.currency ?? 'NGN'));
    return w?.balance ?? '0';
  }, [walletBalances, property?.currency]);
  const maxShares = mine ? Number(mine.shares) : 0;
  const suggestedShareOptions = ['1', '2', '5', '10', '50', '100', '1000'];

  if (!property) return <div className="h-64 animate-pulse rounded-xl bg-dashboard-border/60" />;

  return (
    <div className="space-y-4">
      <BackIconButton href={`/dashboard/properties/${id}?mode=fractional`} />
      <div>
        <h1 className="text-xl font-semibold text-dashboard-heading">Sell</h1>
        <p className="text-xs text-dashboard-body">Enter shares you want to sell</p>
      </div>

      <SectionCard title="Shares to sell">
        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded-lg border border-dashboard-border bg-white px-3 py-2">
            <input
              value={shares}
              onChange={(e) => setShares(e.target.value.replace(/[^\d.]/g, ''))}
              placeholder="1"
              className="w-full bg-transparent text-sm text-dashboard-heading outline-none"
            />
            <span className="text-xs text-dashboard-body">Shares</span>
          </div>
          {mine ? (
            <p className="text-[11px] text-dashboard-body">
              You own {mine.shares} shares (max {String(maxShares)}).
            </p>
          ) : null}
          <div className="text-[11px] text-dashboard-body space-y-0.5">
            <p>Portfolio ({property.currency}): {formatMoney(portfolioStr, property.currency)}</p>
            <p>Wallet available: {formatMoney(walletLiquidStr, property.currency)}</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Suggested shares">
        <div className="flex flex-wrap gap-2">
          {suggestedShareOptions.map((v) => {
            const n = Number(v);
            const disabled = !mine || n > maxShares;
            return (
              <button
                key={v}
                type="button"
                disabled={disabled}
                onClick={() => setShares(v)}
                className="rounded-md border border-dashboard-border px-3 py-1 text-xs text-dashboard-heading disabled:opacity-40"
              >
                {v} {n === 1 ? 'share' : 'shares'}
              </button>
            );
          })}
        </div>
      </SectionCard>

      {!mine ||
      !shares ||
      Number(shares) <= 0 ||
      Number(shares) > maxShares ? (
        <button type="button" disabled className="h-11 w-full rounded-full bg-cohold-blue px-4 text-sm font-medium text-white opacity-50">
          Sell shares now
        </button>
      ) : (
        <Link
          href={`/dashboard/properties/${id}/sell/summary?shares=${encodeURIComponent(shares || '0')}`}
          className="flex h-11 w-full items-center justify-center rounded-full bg-cohold-blue px-4 text-sm font-medium text-white"
        >
          Sell shares now
        </Link>
      )}
    </div>
  );
}
