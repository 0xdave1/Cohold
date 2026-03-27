'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo } from 'react';
import { useInvestmentById } from '@/lib/hooks/use-investments';
import { usePropertyDetails } from '@/lib/hooks/use-properties';
import { formatMoney } from '@/lib/hooks/use-wallet';
import { investmentPositionValue } from '@/lib/money/portfolio';
import { formatAnnualYieldPercent } from '@/lib/format/yield';
import { detectListingMode } from '@/lib/listings/category';
import { BackIconButton, DetailRow, SectionCard } from '../../properties/_components/listing-ui';

export default function PortfolioInvestmentPage() {
  const params = useParams();
  const id = params.id as string;
  const { data: investment, isLoading: invLoading } = useInvestmentById(id);
  const propertyId = investment?.propertyId ?? '';
  const { data: property } = usePropertyDetails(propertyId);

  const mode = useMemo(() => {
    if (!investment?.property) return 'fractional';
    return detectListingMode(investment.property.title, investment.property.description);
  }, [investment?.property]);

  const isFractional = mode === 'fractional';

  const totalReturns = investment?.totalReturns ?? '0';
  const principal = investment?.amount ?? '0';
  const worth = investment ? investmentPositionValue(principal, totalReturns) : '0';

  const ownershipLabel =
    investment?.ownershipPercent != null && investment.ownershipPercent !== ''
      ? `${Number(investment.ownershipPercent).toFixed(2)}%`
      : '—';

  const investmentDateLabel =
    investment?.createdAt != null
      ? new Date(investment.createdAt).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      : null;

  const sharesTotal = property?.sharesTotal ?? investment?.property?.sharesTotal ?? '0';
  const sharesSold = property?.sharesSold ?? investment?.property?.sharesSold ?? '0';
  const sharePrice = property?.sharePrice ?? investment?.property?.sharePrice ?? '0';
  const annualYield =
    property?.annualYield ?? investment?.property?.annualYield ?? null;

  const sharesLeft = useMemo(() => {
    const t = Number(sharesTotal);
    const s = Number(sharesSold);
    if (!Number.isFinite(t) || !Number.isFinite(s)) return 0;
    return Math.max(0, t - s);
  }, [sharesTotal, sharesSold]);

  const fundedPct = useMemo(() => {
    const t = Number(sharesTotal);
    const sold = Number(sharesSold);
    if (!Number.isFinite(t) || t <= 0) return 0;
    return Math.min(100, Math.round((sold / t) * 100));
  }, [sharesTotal, sharesSold]);

  const soldOut = Number(sharesSold) >= Number(sharesTotal) && Number(sharesTotal) > 0;

  if (invLoading || !investment) {
    return <div className="animate-pulse rounded-xl bg-dashboard-border/60 h-64" />;
  }

  const currency = investment.currency;
  const prop = property ?? investment.property;

  return (
    <div className="space-y-6 pb-20">
      <div className="pt-1">
        <BackIconButton href="/dashboard/investments" />
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-wide text-dashboard-body mb-1">Portfolio</p>
        <h1 className="text-[22px] leading-7 font-semibold text-dashboard-heading">{prop.title}</h1>
        <p className="text-xs text-dashboard-body mt-1 flex items-start gap-1">
          <span>{prop.location}</span>
        </p>
      </div>

      {isFractional && (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-3">
          <p className="text-[10px] text-emerald-800 dark:text-emerald-200/90">Total returns (ROI credited)</p>
          <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
            {formatMoney(totalReturns, currency)}
          </p>
          <p className="text-[10px] text-dashboard-body mt-1">Paid monthly when distributed — based on your principal.</p>
        </div>
      )}

      <div className="rounded-xl bg-dashboard-border/30 px-3 py-4">
        <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-3">
          <div>
            <p className="text-[10px] text-dashboard-body">Shares owned</p>
            <p className="text-sm font-semibold text-dashboard-heading">{investment.shares}</p>
          </div>
          <div>
            <p className="text-[10px] text-dashboard-body">Principal invested</p>
            <p className="text-sm font-semibold text-dashboard-heading">{formatMoney(principal, currency)}</p>
          </div>
          <div>
            <p className="text-[10px] text-dashboard-body">Position value</p>
            <p className="text-sm font-semibold text-dashboard-heading">{formatMoney(worth, currency)}</p>
          </div>
          <div>
            <p className="text-[10px] text-dashboard-body">Ownership</p>
            <p className="text-sm font-semibold text-dashboard-heading">{ownershipLabel}</p>
          </div>
          {investmentDateLabel ? (
            <div>
              <p className="text-[10px] text-dashboard-body">Invested on</p>
              <p className="text-sm font-semibold text-dashboard-heading">{investmentDateLabel}</p>
            </div>
          ) : null}
        </div>
      </div>

      {isFractional && property && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] text-dashboard-body">
            <span>Funding</span>
            <span>
              {sharesSold} / {sharesTotal} shares · {fundedPct}% funded
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-dashboard-border">
            <div className="h-1.5 rounded-full bg-[#E3AA2B]" style={{ width: `${fundedPct}%` }} />
          </div>
          <p className="text-[11px] text-dashboard-body">
            Shares left: <span className="font-medium text-dashboard-heading">{sharesLeft}</span>
            {sharesLeft > 0 && sharesLeft <= Number(sharesTotal) * 0.1 ? (
              <span className="ml-2 text-amber-700">Low availability</span>
            ) : null}
          </p>
        </div>
      )}

      {isFractional && (
        <div className="grid grid-cols-2 gap-2">
          <Link
            href={`/dashboard/properties/${investment.propertyId}/sell`}
            className="flex h-11 w-full items-center justify-center rounded-full bg-dashboard-border/60 px-4 text-sm font-medium text-dashboard-heading"
          >
            Sell shares
          </Link>
          {soldOut ? (
            <span className="flex h-11 w-full cursor-not-allowed items-center justify-center rounded-full bg-dashboard-border/40 px-4 text-sm font-medium text-dashboard-body">
              Sold out
            </span>
          ) : (
            <Link
              href={`/dashboard/properties/${investment.propertyId}/invest`}
              className="flex h-11 w-full items-center justify-center rounded-full bg-cohold-blue px-4 text-sm font-medium text-white"
            >
              Buy more
            </Link>
          )}
        </div>
      )}

      <SectionCard title="Property details">
        <DetailRow label="Share price" value={formatMoney(sharePrice, currency)} />
        <DetailRow label="Annual yield (target)" value={formatAnnualYieldPercent(annualYield)} />
        <DetailRow
          label="Term"
          value={property?.duration && property.duration !== '' ? String(property.duration) : '—'}
        />
        <DetailRow label="ROI frequency" value="Monthly" />
      </SectionCard>

      <SectionCard title="Documents">
        <div className="space-y-2">
          {(property?.documents ?? []).length === 0 ? (
            <p className="text-xs text-dashboard-body">No documents uploaded for this listing.</p>
          ) : (
            (property?.documents ?? []).map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between rounded-lg border border-dashboard-border px-3 py-2"
              >
                <div>
                  <p className="text-xs font-medium text-dashboard-heading">{d.type}</p>
                  <p className="text-[10px] text-dashboard-body">Document</p>
                </div>
              </div>
            ))
          )}
        </div>
      </SectionCard>

      <Link
        href={`/dashboard/properties/${investment.propertyId}?mode=fractional`}
        className="block text-center text-sm text-cohold-blue font-medium"
      >
        View property listing
      </Link>
    </div>
  );
}
