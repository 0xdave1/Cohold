'use client';

import { useMemo, useState } from 'react';
import { useProperties } from '@/lib/hooks/use-properties';
import { formatMoney } from '@/lib/hooks/use-wallet';
import Link from 'next/link';
import Image from 'next/image';
import { resolveListingMode } from '@/lib/listings/category';
import { formatAnnualYieldPercent } from '@/lib/format/yield';
import { formatTermForListingCard } from '@/lib/listings/format-term';
import { titleVerificationSubtitleForCard } from '@/lib/listings/legal-status-ui';
import { shortLocationForListingCard } from '@/lib/listings/display-location';
import {
  ActiveStatusPill,
  CategoryPill,
  coholdUi,
  FilterChip,
  ListingEmptyState,
  ListingPageShell,
  ListingSkeleton,
  TitleVerifiedPill,
} from './_components/listing-ui';

type ListingTab = 'all' | 'fractional' | 'land' | 'own-home';

export default function PropertiesPage() {
  const { data, isLoading } = useProperties(1, 20);
  const [tab, setTab] = useState<ListingTab>('all');

  const items = data?.items ?? [];
  const filtered = useMemo(() => {
    if (tab === 'all') return items;
    return items.filter((p) => resolveListingMode(p) === tab);
  }, [items, tab]);

  return (
    <ListingPageShell>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-cohold-text">Listings</h1>
          <p className="text-xs text-cohold-muted">Find properties worth investing</p>
        </div>
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-cohold-border bg-white shadow-sm"
          aria-label="Search listings"
        >
          <svg className="h-4 w-4 text-cohold-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-4.35-4.35m1.35-5.15a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {(
          [
            { key: 'all' as const, label: 'All assets' },
            { key: 'fractional' as const, label: 'Fractional' },
            { key: 'land' as const, label: 'Land' },
            { key: 'own-home' as const, label: 'Own a home' },
          ] as const
        ).map((t) => (
          <FilterChip key={t.key} active={tab === t.key} onClick={() => setTab(t.key)}>
            {t.label}
          </FilterChip>
        ))}
      </div>

      {isLoading ? (
        <ListingSkeleton rows={3} />
      ) : filtered.length === 0 ? (
        <ListingEmptyState
          title="No listings in this category"
          message="Try another filter or check back when new properties are published."
          actionHref="/dashboard/properties"
          actionLabel="View all assets"
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => {
            const category = resolveListingMode(p);
            const mode = category === 'fractional' ? 'fractional' : category === 'land' ? 'land' : 'own-home';
            const cityLine = shortLocationForListingCard(p);
            const titleSubtitle = titleVerificationSubtitleForCard(p.titleVerificationStatus);
            const ctaLabel =
              category === 'fractional' ? 'Invest now' : category === 'land' ? 'Buy now' : 'Own now';
            const priceLabel =
              category === 'fractional'
                ? 'Min. investment'
                : category === 'land' || category === 'own-home'
                  ? 'Min. monthly payment'
                  : 'Min. investment';
            const priceValue =
              category === 'fractional'
                ? formatMoney(p.minInvestment ?? '0', p.currency)
                : formatMoney(p.minInvestment ?? p.totalValue, p.currency);

            const metaParts: string[] = [];
            if (cityLine) metaParts.push(cityLine);
            if (category === 'fractional') {
              metaParts.push(formatAnnualYieldPercent(p.annualYield));
              metaParts.push(formatTermForListingCard(p.termMonths));
            } else if (titleSubtitle) {
              metaParts.push(titleSubtitle);
            }

            return (
              <Link
                key={p.id}
                href={`/dashboard/properties/${p.id}?mode=${mode}`}
                className={`${coholdUi.card} block`}
              >
                <div className="relative h-40 bg-cohold-border/50">
                  {p.coverImageUrl ? (
                    <Image
                      src={p.coverImageUrl}
                      alt={p.title}
                      fill
                      sizes="(max-width: 768px) 100vw, 600px"
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-gradient-to-br from-cohold-border to-cohold-bg text-xs text-cohold-muted">
                      No image
                    </div>
                  )}
                  <div className="absolute left-2 top-2 flex flex-wrap gap-1.5">
                    <CategoryPill listingType={p.listingType} mode={category} />
                    <ActiveStatusPill />
                    {p.titleVerificationStatus?.toUpperCase() === 'VERIFIED' ? <TitleVerifiedPill /> : null}
                  </div>
                </div>
                <div className="p-3.5">
                  <p className="text-base font-semibold leading-snug text-cohold-text line-clamp-2">{p.title}</p>
                  {metaParts.length > 0 ? (
                    <p className="mt-1 text-xs text-cohold-muted">{metaParts.join('  ·  ')}</p>
                  ) : null}
                  <div className="mt-3 flex items-end justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] text-cohold-muted">{priceLabel}</p>
                      <p className="text-xl font-bold leading-tight text-cohold-text">{priceValue}</p>
                      {category === 'fractional' ? (
                        <p className="mt-0.5 text-[10px] text-cohold-muted">
                          Share price {formatMoney(p.sharePrice ?? p.totalValue, p.currency)}
                          <span className="font-normal"> /share</span>
                        </p>
                      ) : null}
                    </div>
                    <span className="inline-flex shrink-0 items-center rounded-full bg-cohold-primary px-4 py-2 text-xs font-semibold text-white hover:bg-cohold-primary-hover">
                      {ctaLabel}
                    </span>
                  </div>
                  {category === 'fractional' ? (
                    <p className={`mt-2 ${coholdUi.riskNote}`}>
                      Projected yield is an estimate, not a guarantee. Capital is at risk.
                    </p>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </ListingPageShell>
  );
}
