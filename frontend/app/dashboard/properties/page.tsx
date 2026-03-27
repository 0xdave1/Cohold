'use client';

import { useMemo, useState } from 'react';
import { useProperties } from '@/lib/hooks/use-properties';
import { formatMoney } from '@/lib/hooks/use-wallet';
import Link from 'next/link';
import { detectListingMode, modeLabel } from '@/lib/listings/category';
import { formatAnnualYieldPercent } from '@/lib/format/yield';

type ListingTab = 'all' | 'fractional' | 'land' | 'own-home';

export default function PropertiesPage() {
  const { data, isLoading } = useProperties(1, 20);
  const [tab, setTab] = useState<ListingTab>('all');

  const items = data?.items ?? [];
  const filtered = useMemo(() => {
    if (tab === 'all') return items;
    return items.filter((p) => detectListingMode(p.title, p.description) === tab);
  }, [items, tab]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-dashboard-heading">Listings</h1>
          <p className="text-xs text-dashboard-body">Find properties worth investing</p>
        </div>
        <button
          type="button"
          className="h-8 w-8 rounded-lg border border-dashboard-border bg-dashboard-card flex items-center justify-center"
          aria-label="Search listings"
        >
          <svg className="h-4 w-4 text-dashboard-body" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-4.35-4.35m1.35-5.15a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          { key: 'all', label: 'All assets' },
          { key: 'fractional', label: 'Fractional' },
          { key: 'land', label: 'Land' },
          { key: 'own-home', label: 'Own a home' },
        ].map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key as ListingTab)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs border transition-colors ${
                active
                  ? 'bg-[#F5D99A] text-dashboard-heading border-[#E7C97E]'
                  : 'bg-dashboard-card text-dashboard-body border-dashboard-border'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-dashboard-border bg-dashboard-card p-3 animate-pulse h-56" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => {
            const category = detectListingMode(p.title, p.description);
            const cta = category === 'fractional' ? 'Invest now' : category === 'land' ? 'Buy now' : 'Own now';
            const mode = category === 'fractional' ? 'fractional' : category === 'land' ? 'land' : 'own-home';
            return (
              <Link
                key={p.id}
                href={`/dashboard/properties/${p.id}?mode=${mode}`}
                className="rounded-xl border border-dashboard-border bg-dashboard-card overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.05)] block"
              >
                <div className="relative h-32 bg-dashboard-border/60">
                  <div className="absolute left-2 top-2 flex gap-1.5">
                    <span className="rounded-md bg-[#D6EDF8] px-2 py-0.5 text-[10px] font-medium text-[#0A4A74]">
                      {modeLabel(category)}
                    </span>
                    <span className="rounded-md bg-[#D9F5E5] px-2 py-0.5 text-[10px] font-medium text-[#127C4B]">
                      Cof O Verified
                    </span>
                  </div>
                </div>
                <div className="p-3">
                  <p className="text-base font-medium text-dashboard-heading line-clamp-2">{p.title}</p>
                  <p className="text-xs text-dashboard-body mt-1">
                    {p.location}
                    {category === 'fractional'
                      ? `  |  ${formatAnnualYieldPercent(p.annualYield)} p.a.  |  ${p.duration && String(p.duration).trim() ? p.duration : 'Term TBD'}`
                      : ''}
                  </p>
                  <div className="mt-3 flex items-end justify-between gap-2">
                    <div>
                      <p className="text-[11px] text-dashboard-body">
                        {category === 'fractional' ? 'Share price' : category === 'land' ? 'Plot price' : 'Home price'}
                      </p>
                      <p className="text-[22px] leading-tight font-bold text-dashboard-heading">
                        {formatMoney(category === 'fractional' ? p.sharePrice ?? p.totalValue : p.totalValue, p.currency)}
                      </p>
                    </div>
                    <p className="rounded-full bg-cohold-blue px-3.5 py-2 text-xs font-medium text-white">
                      {cta}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
