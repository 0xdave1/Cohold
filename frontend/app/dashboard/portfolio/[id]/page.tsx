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
import {
  BackIconButton,
  ChatSupportRow,
  coholdUi,
  DetailRow,
  DeveloperLine,
  DocumentsSection,
  FeatureChips,
  GoldProgressBar,
  InvestmentStatsCard,
  ListingHero,
  ListingSkeleton,
  LocationPinLine,
  SectionCard,
  SoldOutPill,
  StickyBottomBar,
} from '../../properties/_components/listing-ui';
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
    return <ListingSkeleton rows={1} />;
  }
  if (!investment || !prop) {
    return (
      <div className="space-y-4 pt-4">
        <BackIconButton href="/dashboard/investments" />
        <p className="text-sm text-cohold-muted">Investment not found or not accessible.</p>
      </div>
    );
  }

  const currency = investment.currency;

  return (
    <div className="relative space-y-5 pb-32">
      <BackIconButton href="/dashboard/investments" />

      <ListingHero
        title={prop.title}
        images={galleryImages.map((img) => ({ id: img.id, url: img.url, altText: img.altText ?? null }))}
        imageUrl={heroImage}
        imageCount={galleryImages.length}
        tall
      />

      <div className="space-y-2">
        {isFractional && soldOut ? <SoldOutPill /> : null}
        <h1 className="text-2xl font-semibold leading-8 text-cohold-text">{prop.title}</h1>
        <LocationPinLine>{locationLine || 'Location not specified.'}</LocationPinLine>
        {prop.developerName?.trim() ? (
          <DeveloperLine name={prop.developerName.trim()} isPartner={prop.isListedPartnerDeveloper} />
        ) : null}
      </div>

      <InvestmentStatsCard
        tiles={[
          { label: 'Amt. invested', value: formatMoney(principal, currency) },
          { label: 'Investment worth', value: formatMoney(worth, currency) },
          { label: 'Ownership %', value: ownershipLabel },
        ]}
        footer="Investment worth is principal plus paid distributions. Projected yield is not paid income."
      />

      {isFractional && property ? (
        <div className="space-y-1">
          <GoldProgressBar percent={fundedPct} />
          <p className="text-[11px] text-cohold-muted">
            Shares owned: <span className="font-medium text-cohold-text">{investment.shares}</span>
            {' · '}
            {sharesSold} / {sharesTotal} allocated
            {sharesLeft > 0 && sharesLeft <= Number(sharesTotal) * 0.1 ? (
              <span className="ml-2 text-amber-700">Low availability</span>
            ) : null}
          </p>
        </div>
      ) : null}

      <ChatSupportRow />

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
        <p className="text-xs leading-5 text-cohold-muted">
          {prop.description?.trim() ? prop.description : 'No description provided yet for this listing.'}
        </p>
      </SectionCard>

      <SectionCard title="Property features">
        <FeatureChips features={featureList} />
      </SectionCard>

      <DocumentsSection
        documents={property?.documents ?? []}
        documentsAvailable={property?.documentsAvailable ?? investment.property?.documentsAvailable}
      />

      <SectionCard title="Distribution status">
        <div className="space-y-2">
          {(distributions?.items ?? [])
            .filter((d) => d.investment?.id === investment.id || d.batch?.propertyId === investment.propertyId)
            .slice(0, 10)
            .map((d) => {
              const status = normalizeDistributionStatus(d.status ?? d.batch?.status);
              return (
                <div key={d.id} className="rounded-lg border border-cohold-border px-3 py-2">
                  <p className="text-xs font-medium text-cohold-text">
                    {formatMoney(d.amount, d.currency)} · {distributionStatusLabel(status)}
                  </p>
                  <p className="text-[11px] text-cohold-muted">
                    {d.batch?.periodStart?.slice(0, 10) ?? '—'} to {d.batch?.periodEnd?.slice(0, 10) ?? '—'}
                  </p>
                  {d.failureReason ? <p className="text-[11px] text-red-700">Failure: {d.failureReason}</p> : null}
                </div>
              );
            })}
          {(distributions?.items ?? []).filter(
            (d) => d.investment?.id === investment.id || d.batch?.propertyId === investment.propertyId,
          ).length === 0 ? (
            <p className="text-xs text-cohold-muted">No paid distributions yet.</p>
          ) : null}
        </div>
      </SectionCard>

      <Link href={`/dashboard/properties/${investment.propertyId}`} className="block text-center text-sm font-medium text-cohold-primary">
        View property listing
      </Link>

      {isFractional ? (
        <StickyBottomBar>
          <div className="grid grid-cols-2 gap-2">
            <Link href={`/dashboard/properties/${investment.propertyId}/sell`} className={coholdUi.secondaryBtn}>
              Sell back to platform
            </Link>
            {soldOut ? (
              <span className={`${coholdUi.secondaryBtn} cursor-not-allowed opacity-60`}>Sold out</span>
            ) : (
              <Link href={`/dashboard/properties/${investment.propertyId}/invest`} className={coholdUi.primaryBtn}>
                Buy shares
              </Link>
            )}
          </div>
        </StickyBottomBar>
      ) : null}
    </div>
  );
}
