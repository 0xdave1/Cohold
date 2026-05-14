'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo } from 'react';
import { useInvestmentById } from '@/lib/hooks/use-investments';
import { usePropertyDetails } from '@/lib/hooks/use-properties';
import { formatMoney } from '@/lib/hooks/use-wallet';
import { useUserDistributionHistory } from '@/lib/hooks/use-distributions';
import { investmentPositionValue } from '@/lib/money/portfolio';
import { formatAnnualYieldPercent } from '@/lib/format/yield';
import { resolveListingMode } from '@/lib/listings/category';
import { formatTermForDetail } from '@/lib/listings/format-term';
import {
  formatLegalReviewLabel,
  formatTitleVerificationLabel,
  formatYieldBasisLabel,
} from '@/lib/listings/legal-status-ui';
import { BackIconButton, DetailRow, ListingHero, SectionCard } from '../../properties/_components/listing-ui';
import { distributionStatusLabel, normalizeDistributionStatus } from '@/lib/distributions/status';

function parseFeatureList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
}

export default function PortfolioInvestmentPage() {
  const params = useParams();
  const id = params.id as string;
  const { data: investment, isLoading: invLoading } = useInvestmentById(id);
  const { data: distributions } = useUserDistributionHistory(1, 50);
  const propertyId = investment?.propertyId ?? '';
  const { data: property } = usePropertyDetails(propertyId);

  const prop = property ?? investment?.property;
  const mode = useMemo(() => {
    if (!prop) return 'fractional';
    return resolveListingMode(prop);
  }, [prop]);

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
          month: '2-digit',
          year: 'numeric',
        })
      : null;

  const sharesTotal = property?.sharesTotal ?? investment?.property?.sharesTotal ?? '0';
  const sharesSold = property?.sharesSold ?? investment?.property?.sharesSold ?? '0';
  const sharePrice = property?.sharePrice ?? investment?.property?.sharePrice ?? '0';
  const annualYield =
    property?.annualYield ?? property?.projectedAnnualYield ?? investment?.property?.annualYield ?? null;

  const sharesLeft = useMemo(() => {
    const t = Number(sharesTotal);
    const s = Number(sharesSold);
    if (!Number.isFinite(t) || !Number.isFinite(s)) return 0;
    return Math.max(0, t - s);
  }, [sharesTotal, sharesSold]);

  const fundedPct = useMemo(() => {
    const fromApi = property?.fundingProgressPercent;
    if (fromApi != null && fromApi !== '') {
      const n = Number(fromApi);
      if (Number.isFinite(n)) return Math.max(0, Math.min(100, Math.round(n)));
    }
    const t = Number(sharesTotal);
    const sold = Number(sharesSold);
    if (!Number.isFinite(t) || t <= 0) return 0;
    return Math.min(100, Math.round((sold / t) * 100));
  }, [sharesTotal, sharesSold, property?.fundingProgressPercent]);

  const soldOut = Number(sharesSold) >= Number(sharesTotal) && Number(sharesTotal) > 0;

  const galleryImages = property?.images ?? [];
  const heroImage = galleryImages[0]?.url ?? property?.coverImageUrl ?? null;
  const featureList = parseFeatureList(property?.features ?? investment?.property?.features);

  const locationLine =
    (property?.displayLocation?.trim() ||
      [property?.city, property?.state].filter(Boolean).join(', ') ||
      prop?.location) ??
    '';

  if (invLoading) {
    return <div className="animate-pulse rounded-xl bg-dashboard-border/60 h-64" />;
  }
  if (!investment || !prop) {
    return (
      <div className="space-y-4 pt-4">
        <BackIconButton href="/dashboard/investments" />
        <p className="text-sm text-dashboard-body">Investment not found or not accessible.</p>
      </div>
    );
  }

  const currency = investment.currency;

  return (
    <div className="space-y-6 pb-24">
      <div className="pt-1">
        <BackIconButton href="/dashboard/investments" />
      </div>

      <ListingHero
        title={prop.title}
        images={galleryImages.map((img) => ({ id: img.id, url: img.url, altText: img.altText ?? null }))}
        imageUrl={heroImage}
        imageCount={galleryImages.length}
      />

      <div className="space-y-2">
        {isFractional && soldOut ? (
          <p className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-900">
            Sold out
          </p>
        ) : null}
        <h1 className="text-[22px] leading-7 font-semibold text-dashboard-heading">{prop.title}</h1>
        <p className="text-xs text-dashboard-body flex items-start gap-1">
          <svg
            className="h-3.5 w-3.5 mt-0.5 shrink-0 text-dashboard-body"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>{locationLine || 'Location not specified.'}</span>
        </p>
        {prop.developerName?.trim() ? (
          <p className="text-xs text-dashboard-body flex flex-wrap items-center gap-1">
            <span>by {prop.developerName.trim()}</span>
            {prop.isListedPartnerDeveloper ? (
              <svg className="h-3.5 w-3.5 text-emerald-600 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-label="Listed partner developer">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
            ) : null}
          </p>
        ) : null}
      </div>

      <div className="rounded-xl bg-dashboard-border/30 px-3 py-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-[10px] text-dashboard-body">Amt. invested</p>
            <p className="text-sm font-semibold text-dashboard-heading leading-tight">{formatMoney(principal, currency)}</p>
          </div>
          <div>
            <p className="text-[10px] text-dashboard-body">Investment worth</p>
            <p className="text-sm font-semibold text-dashboard-heading leading-tight">{formatMoney(worth, currency)}</p>
          </div>
          <div>
            <p className="text-[10px] text-dashboard-body">Ownership %</p>
            <p className="text-sm font-semibold text-dashboard-heading leading-tight">{ownershipLabel}</p>
          </div>
        </div>
        <p className="text-[10px] text-dashboard-body mt-3 text-center">
          Investment worth is principal plus paid distributions credited to your wallet for this position. Projected yield is
          not paid income.
        </p>
      </div>

      {isFractional && property && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] text-dashboard-body">
            <span>Investment progress</span>
            <span>{fundedPct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-dashboard-border">
            <div className="h-1.5 rounded-full bg-[#E3AA2B]" style={{ width: `${fundedPct}%` }} />
          </div>
          <p className="text-[11px] text-dashboard-body">
            Shares owned: <span className="font-medium text-dashboard-heading">{investment.shares}</span>
            {' · '}
            {sharesSold} / {sharesTotal} shares allocated
            {sharesLeft > 0 && sharesLeft <= Number(sharesTotal) * 0.1 ? (
              <span className="ml-2 text-amber-700">Low availability</span>
            ) : null}
          </p>
        </div>
      )}

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Link
          href="/dashboard/support"
          className="flex h-10 items-center justify-center rounded-full bg-dashboard-border/60 text-sm font-medium text-cohold-blue"
        >
          Chat with us
        </Link>
        <button
          type="button"
          className="h-10 w-10 rounded-full border border-dashboard-border bg-dashboard-card flex items-center justify-center"
          aria-label="Share or open"
        >
          <svg className="h-4 w-4 text-dashboard-body" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10l7-7m0 0h-6m6 0v6M10 14l-7 7m0 0h6m-6 0v-6" />
          </svg>
        </button>
      </div>

      <SectionCard title={isFractional ? 'Property investment details' : 'Listing details'}>
        {isFractional ? (
          <>
            <DetailRow label="Share price" value={formatMoney(sharePrice, currency)} />
            <DetailRow label="Shares owned" value={String(investment.shares)} />
            {investmentDateLabel ? <DetailRow label="Investment date" value={investmentDateLabel} /> : null}
            <DetailRow label="Projected annual yield" value={formatAnnualYieldPercent(annualYield)} />
            <DetailRow label="Yield basis" value={formatYieldBasisLabel(property?.yieldBasis ?? investment.property?.yieldBasis)} />
            <DetailRow
              label="Expected return disclosure"
              value={
                property?.expectedReturnDisclosure?.trim() || investment.property?.expectedReturnDisclosure?.trim()
                  ? (property?.expectedReturnDisclosure ?? investment.property?.expectedReturnDisclosure) ?? ''
                  : 'Not provided for this listing.'
              }
            />
            <DetailRow label="Term" value={formatTermForDetail(property?.termMonths ?? investment.property?.termMonths ?? null)} />
            <DetailRow
              label="Title verification status"
              value={formatTitleVerificationLabel(
                property?.titleVerificationStatus ?? investment.property?.titleVerificationStatus,
              )}
            />
            <DetailRow
              label="Legal review status"
              value={formatLegalReviewLabel(property?.legalReviewStatus ?? investment.property?.legalReviewStatus)}
            />
            <DetailRow
              label="Risk disclosure"
              value={
                property?.riskDisclosure?.trim() || investment.property?.riskDisclosure?.trim()
                  ? (property?.riskDisclosure ?? investment.property?.riskDisclosure) ?? ''
                  : 'Not provided for this listing.'
              }
            />
            <DetailRow
              label="No. of investors"
              value={(() => {
                const n = property?.investorCount ?? investment.property?.investorCount;
                return n != null && Number.isFinite(Number(n)) ? String(n) : '—';
              })()}
            />
            <DetailRow label="Total shares" value={String(sharesTotal)} />
            <DetailRow label="Total investment worth" value={formatMoney(prop.totalValue, prop.currency)} />
          </>
        ) : (
          <>
            <DetailRow label="Min. payment" value={formatMoney(prop.minInvestment ?? '0', currency)} />
            {investmentDateLabel ? <DetailRow label="Investment date" value={investmentDateLabel} /> : null}
            <DetailRow
              label="Title verification status"
              value={formatTitleVerificationLabel(
                property?.titleVerificationStatus ?? investment.property?.titleVerificationStatus,
              )}
            />
            <DetailRow
              label="Legal review status"
              value={formatLegalReviewLabel(property?.legalReviewStatus ?? investment.property?.legalReviewStatus)}
            />
            <DetailRow
              label="Risk disclosure"
              value={
                property?.riskDisclosure?.trim() || investment.property?.riskDisclosure?.trim()
                  ? (property?.riskDisclosure ?? investment.property?.riskDisclosure) ?? ''
                  : 'Not provided for this listing.'
              }
            />
            <DetailRow label="Term" value={formatTermForDetail(property?.termMonths ?? investment.property?.termMonths ?? null)} />
            <DetailRow label="Listing value" value={formatMoney(prop.totalValue, prop.currency)} />
          </>
        )}
      </SectionCard>

      <SectionCard title="Property description">
        <p className="text-xs leading-5 text-dashboard-body">
          {prop.description?.trim() ? prop.description : 'No description provided yet for this listing.'}
        </p>
      </SectionCard>

      <SectionCard title="Property features">
        <div className="flex flex-wrap gap-1.5">
          {featureList.length === 0 ? (
            <p className="text-xs text-dashboard-body">No features listed for this property yet.</p>
          ) : (
            featureList.map((f) => (
              <span key={f} className="rounded-full border border-dashboard-border px-2.5 py-1 text-[10px] text-dashboard-body">
                {f}
              </span>
            ))
          )}
        </div>
      </SectionCard>

      <SectionCard title="Property documents">
        <div className="space-y-2">
          {(property?.documents ?? []).length === 0 ? (
            <p className="text-xs text-dashboard-body">No documents uploaded for this listing.</p>
          ) : (
            (property?.documents ?? []).map((d) => (
              <a
                key={d.id}
                href={d.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-lg border border-dashboard-border px-3 py-2"
              >
                <div>
                  <p className="text-xs font-medium text-dashboard-heading">{d.type}</p>
                  <p className="text-[10px] text-dashboard-body">Document</p>
                </div>
                <svg className="h-4 w-4 text-dashboard-body" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10l7-7m0 0h-6m6 0v6M10 14l-7 7m0 0h6m-6 0v-6" />
                </svg>
              </a>
            ))
          )}
          <p className="text-[11px] text-dashboard-body">
            Document availability:{' '}
            {property?.documentsAvailable ?? investment.property?.documentsAvailable ? 'Available' : 'Not specified'}
          </p>
        </div>
      </SectionCard>

      {isFractional && (
        <div className="grid grid-cols-2 gap-2">
          <Link
            href={`/dashboard/properties/${investment.propertyId}/sell`}
            className="flex h-11 w-full items-center justify-center rounded-full bg-dashboard-border/60 px-4 text-sm font-medium text-dashboard-heading"
          >
            Sell back to platform
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
              Buy shares
            </Link>
          )}
        </div>
      )}

      <SectionCard title="Distribution status">
        <div className="space-y-2">
          {(distributions?.items ?? [])
            .filter((d) => d.investment?.id === investment.id || d.batch?.propertyId === investment.propertyId)
            .slice(0, 10)
            .map((d) => {
              const status = normalizeDistributionStatus(d.status ?? d.batch?.status);
              return (
                <div key={d.id} className="rounded-lg border border-dashboard-border px-3 py-2">
                  <p className="text-xs font-medium text-dashboard-heading">
                    {formatMoney(d.amount, d.currency)} · {distributionStatusLabel(status)}
                  </p>
                  <p className="text-[11px] text-dashboard-body">
                    {d.batch?.periodStart?.slice(0, 10) ?? '—'} to {d.batch?.periodEnd?.slice(0, 10) ?? '—'}
                  </p>
                  {d.failureReason ? <p className="text-[11px] text-red-700">Failure: {d.failureReason}</p> : null}
                </div>
              );
            })}
          {(distributions?.items ?? []).filter((d) => d.investment?.id === investment.id || d.batch?.propertyId === investment.propertyId)
            .length === 0 ? (
            <p className="text-xs text-dashboard-body">No paid distributions yet.</p>
          ) : null}
        </div>
      </SectionCard>

      <Link href={`/dashboard/properties/${investment.propertyId}`} className="block text-center text-sm text-cohold-blue font-medium">
        View property listing
      </Link>
    </div>
  );
}
