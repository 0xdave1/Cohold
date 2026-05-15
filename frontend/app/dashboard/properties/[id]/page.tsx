'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { usePropertyDetails } from '@/lib/hooks/use-properties';
import { useMyInvestments } from '@/lib/hooks/use-investments';
import { useMe } from '@/lib/hooks/use-onboarding';
import { formatMoney } from '@/lib/hooks/use-wallet';
import { resolveListingMode } from '@/lib/listings/category';
import { formatTermForDetail } from '@/lib/listings/format-term';
import {
  formatLegalReviewLabel,
  formatTitleVerificationLabel,
  formatYieldBasisLabel,
} from '@/lib/listings/legal-status-ui';
import { investmentPositionValue } from '@/lib/money/portfolio';
import { formatAnnualYieldPercent } from '@/lib/format/yield';
import {
  ActiveStatusPill,
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
} from '../_components/listing-ui';
import Decimal from 'decimal.js';
import { isKycMoneyActionAllowed } from '@/lib/kyc/status';

function plotSizeLabel(terms: string | null | undefined): string {
  if (!terms?.trim()) return 'Not specified.';
  const match = terms.match(/\d[\d,.]*\s*(sqm|sq\s*m|square\s*met(er|re)s?)/i);
  return match ? match[0] : 'Not specified.';
}

function paymentProgressPercent(property: {
  fundingProgressPercent?: string | null;
  currentRaised?: string;
  totalValue: string;
}): number {
  const fromApi = Number(property.fundingProgressPercent);
  if (Number.isFinite(fromApi) && fromApi >= 0) return Math.min(100, Math.round(fromApi));
  const raised = Number(property.currentRaised ?? 0);
  const total = Number(property.totalValue);
  if (!Number.isFinite(raised) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.min(100, Math.round((raised / total) * 100));
}

export default function PropertyDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const { data: property, isLoading } = usePropertyDetails(id);
  const { data: myInvestments } = useMyInvestments(1, 100);
  const { data: me, isLoading: meLoading } = useMe();

  const myPositions = useMemo(() => {
    const items = myInvestments?.items ?? [];
    return items.filter((i) => i.propertyId === id && (i.status ?? 'ACTIVE') === 'ACTIVE');
  }, [myInvestments?.items, id]);

  const positionAgg = useMemo(() => {
    if (!property || myPositions.length === 0) return null;
    let amount = new Decimal(0);
    let shares = new Decimal(0);
    let totalReturns = new Decimal(0);
    for (const p of myPositions) {
      amount = amount.plus(new Decimal(String(p.amount)));
      shares = shares.plus(new Decimal(String(p.shares)));
      totalReturns = totalReturns.plus(new Decimal(String(p.totalReturns ?? '0')));
    }
    const sharesTotalDec = new Decimal(String(property.sharesTotal ?? '0'));
    const ownershipPct = sharesTotalDec.gt(0)
      ? shares.div(sharesTotalDec).mul(100).toDecimalPlaces(4, Decimal.ROUND_DOWN)
      : new Decimal(0);
    const worth = new Decimal(investmentPositionValue(amount.toFixed(4), totalReturns.toFixed(4)));
    return {
      amount: amount.toFixed(4),
      shares: shares.toFixed(8),
      totalReturns: totalReturns.toFixed(4),
      ownershipPercent: ownershipPct.toFixed(4),
      worth: worth.toFixed(4),
      firstInvestmentId: myPositions[0]?.id,
    };
  }, [myPositions, property]);

  const myInvestment = myPositions[0];
  const isInvested = myPositions.length > 0;

  if (isLoading || !property) {
    return <ListingSkeleton rows={1} />;
  }

  const modeFromQuery = searchParams.get('mode');
  const modeFromApi = resolveListingMode(property);
  const mode =
    modeFromQuery === 'fractional' || modeFromQuery === 'land' || modeFromQuery === 'own-home'
      ? modeFromQuery
      : modeFromApi;

  const sharePrice = property.sharePrice ?? property.totalValue;
  const sharesTotal = property.sharesTotal ?? '0';
  const sharesSold = property.sharesSold ?? '0';
  const isFractional = mode === 'fractional';
  const isLand = mode === 'land';
  const isOwnHome = mode === 'own-home';
  const primaryLabel = isFractional ? 'Invest now' : isLand ? 'Buy land' : 'Own a home';
  const nextPath = isFractional
    ? `/dashboard/properties/${id}/invest`
    : isLand
      ? `/dashboard/properties/${id}/buy-land`
      : `/dashboard/properties/${id}/own-home`;
  const installmentPath = `/dashboard/properties/${id}/installment`;
  const investorCount = property.investorCount ?? 0;
  const galleryImages = property.images ?? [];
  const heroImage = galleryImages[0]?.url ?? property.coverImageUrl ?? null;

  const sharesTotalNum = Number(sharesTotal);
  const sharesSoldNum = Number(sharesSold);
  const sharesLeft =
    Number.isFinite(sharesTotalNum) && Number.isFinite(sharesSoldNum)
      ? Math.max(0, sharesTotalNum - sharesSoldNum)
      : 0;
  const soldOut = sharesTotalNum > 0 && sharesSoldNum >= sharesTotalNum;
  const kycAllowed = isKycMoneyActionAllowed(me?.kycStatus);

  const annualYield = property.annualYield ?? property.projectedAnnualYield;
  const durationLabel = formatTermForDetail(property.termMonths ?? null);
  const locationLine = (property.displayLocation && property.displayLocation.trim()) || property.location;
  const featureList = Array.isArray(property.features) ? property.features : [];
  const fundPct = paymentProgressPercent(property);
  const progressLabel = isOwnHome ? 'Payment progress' : 'Investment progress';

  const investmentDateLabel =
    myInvestment?.createdAt != null
      ? new Date(myInvestment.createdAt).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
      : null;

  const stickyCta = (() => {
    if (isFractional && isInvested) {
      return (
        <div className="grid grid-cols-2 gap-2">
          <Link href={`/dashboard/properties/${id}/sell`} className={coholdUi.secondaryBtn}>
            Sell back to platform
          </Link>
          {soldOut ? (
            <span className={`${coholdUi.secondaryBtn} cursor-not-allowed opacity-60`}>Sold out</span>
          ) : (
            <Link
              href={kycAllowed ? `/dashboard/properties/${id}/invest` : '/dashboard/kyc'}
              className={kycAllowed ? coholdUi.primaryBtn : coholdUi.secondaryBtn}
            >
              {kycAllowed ? 'Buy shares' : 'Complete KYC'}
            </Link>
          )}
        </div>
      );
    }
    if (isFractional && !isInvested) {
      if (soldOut) {
        return <p className={`text-center text-sm ${coholdUi.body}`}>Offering closed (all shares allocated)</p>;
      }
      return (
        <Link href={kycAllowed ? nextPath : '/dashboard/kyc'} className={kycAllowed ? coholdUi.primaryBtn : coholdUi.secondaryBtn}>
          {kycAllowed ? 'Invest now' : 'Complete KYC'}
        </Link>
      );
    }
    if (isLand || isOwnHome) {
      return (
        <div className="grid grid-cols-2 gap-2">
          <Link href="/dashboard/support" className={coholdUi.ghostBtn}>
            Contact support
          </Link>
          <Link href={kycAllowed ? nextPath : '/dashboard/kyc'} className={kycAllowed ? coholdUi.primaryBtn : coholdUi.secondaryBtn}>
            {kycAllowed ? primaryLabel : 'Complete KYC'}
          </Link>
        </div>
      );
    }
    return null;
  })();

  return (
    <div className="relative space-y-5 pb-32">
      <BackIconButton href="/dashboard/properties" />

      <ListingHero
        title={property.title}
        images={galleryImages.map((img) => ({ id: img.id, url: img.url, altText: img.altText ?? null }))}
        imageUrl={heroImage}
        imageCount={galleryImages.length}
        tall
      />

      <div className="space-y-2">
        {soldOut ? <SoldOutPill /> : <ActiveStatusPill />}
        <h1 className="text-2xl font-semibold leading-8 text-cohold-text">{property.title}</h1>
        <LocationPinLine>{locationLine || 'Location not specified.'}</LocationPinLine>
        {property.developerName?.trim() ? (
          <DeveloperLine name={property.developerName.trim()} isPartner={property.isListedPartnerDeveloper} />
        ) : null}
      </div>

      {isInvested && isFractional && positionAgg ? (
        <InvestmentStatsCard
          tiles={[
            { label: 'Amt. invested', value: formatMoney(positionAgg.amount, property.currency) },
            { label: 'Investment worth', value: formatMoney(positionAgg.worth, property.currency) },
            {
              label: 'Ownership %',
              value: `${Number(positionAgg.ownershipPercent).toFixed(2)}%`,
            },
          ]}
          footer="Investment worth is principal plus paid distributions. Projected yield is not paid income."
        />
      ) : null}

      <div>
        <p className="text-xs text-cohold-muted">
          {isFractional ? 'Share price' : isLand ? 'Plot price' : 'Min. monthly payment'}
        </p>
        <p className="text-2xl font-bold text-cohold-text">
          {formatMoney(isFractional ? sharePrice : isOwnHome ? property.minInvestment ?? '0' : property.totalValue, property.currency)}
          {isFractional ? <span className="text-sm font-normal text-cohold-muted"> /share</span> : null}
        </p>
      </div>

      {(isFractional || isOwnHome) && (
        <div className="space-y-1">
          <GoldProgressBar percent={fundPct} label={progressLabel} />
          {isFractional ? (
            <p className="text-[11px] text-cohold-muted">
              {sharesSold} / {sharesTotal} shares · {sharesLeft} left
            </p>
          ) : (
            <p className="text-[11px] text-cohold-muted">
              Raised {formatMoney(property.currentRaised ?? '0', property.currency)} of{' '}
              {formatMoney(property.totalValue, property.currency)}
            </p>
          )}
        </div>
      )}

      <ChatSupportRow />

      {isFractional ? (
        <SectionCard title="Property investment details">
          <DetailRow label="Min. investment amount" value={formatMoney(property.minInvestment ?? '0', property.currency)} />
          <DetailRow label="Share price" value={formatMoney(sharePrice, property.currency)} />
          <DetailRow label="Projected annual yield" value={formatAnnualYieldPercent(annualYield)} />
          <DetailRow label="Yield basis" value={formatYieldBasisLabel(property.yieldBasis)} />
          <DetailRow
            label="Expected return disclosure"
            value={property.expectedReturnDisclosure?.trim() || 'Not provided for this listing.'}
          />
          <DetailRow label="Term" value={durationLabel} />
          <DetailRow label="Title verification status" value={formatTitleVerificationLabel(property.titleVerificationStatus)} />
          <DetailRow label="Legal review status" value={formatLegalReviewLabel(property.legalReviewStatus)} />
          <DetailRow label="Risk disclosure" value={property.riskDisclosure?.trim() || 'Not provided for this listing.'} />
          {investmentDateLabel && isInvested ? <DetailRow label="Investment date" value={investmentDateLabel} /> : null}
          <DetailRow label="No. of investors" value={String(investorCount)} />
          <DetailRow label="Total shares" value={sharesTotal} />
          <DetailRow label="Total investment worth" value={formatMoney(property.totalValue, property.currency)} />
        </SectionCard>
      ) : null}

      {isLand ? (
        <SectionCard title="Land details">
          <DetailRow label="Plot price" value={formatMoney(property.totalValue, property.currency)} />
          <DetailRow label="Min. payment" value={formatMoney(property.minInvestment ?? '0', property.currency)} />
          <DetailRow label="Plot size" value={plotSizeLabel(property.terms)} />
          <DetailRow label="Land document status" value={formatTitleVerificationLabel(property.titleVerificationStatus)} />
          <DetailRow label="Legal review status" value={formatLegalReviewLabel(property.legalReviewStatus)} />
          <DetailRow
            label="Land quality"
            value={featureList[0] ?? 'Not specified.'}
          />
          <DetailRow label="Term" value={durationLabel} />
          <DetailRow label="Risk disclosure" value={property.riskDisclosure?.trim() || 'Not provided for this listing.'} />
        </SectionCard>
      ) : null}

      {isOwnHome ? (
        <SectionCard title="Property ownership details">
          <DetailRow label="Min. monthly payment" value={formatMoney(property.minInvestment ?? '0', property.currency)} />
          <DetailRow label="Total amount" value={formatMoney(property.totalValue, property.currency)} />
          <DetailRow label="Amount raised" value={formatMoney(property.currentRaised ?? '0', property.currency)} />
          <DetailRow
            label="Payment note"
            value={property.terms?.trim() || 'Not provided for this listing.'}
          />
          <DetailRow label="Title verification status" value={formatTitleVerificationLabel(property.titleVerificationStatus)} />
          <DetailRow label="Legal review status" value={formatLegalReviewLabel(property.legalReviewStatus)} />
          <DetailRow label="Term" value={durationLabel} />
          <DetailRow label="Risk disclosure" value={property.riskDisclosure?.trim() || 'Not provided for this listing.'} />
        </SectionCard>
      ) : null}

      <SectionCard title={isLand ? 'Land description' : isOwnHome ? 'Property description' : 'Property description'}>
        <p className="text-xs leading-5 text-cohold-muted">
          {property.description?.trim() || 'No description provided yet for this listing.'}
        </p>
      </SectionCard>

      <SectionCard title={isLand ? 'Land features' : 'Property features'}>
        <FeatureChips
          features={featureList}
          emptyLabel={isLand ? 'No land features listed yet.' : 'No features listed for this property yet.'}
        />
      </SectionCard>

      <DocumentsSection
        title={isLand ? 'Land documents' : 'Property documents'}
        documents={(property.documents ?? []).slice(0, 6)}
        documentsAvailable={property.documentsAvailable}
      />

      {isOwnHome && kycAllowed ? (
        <Link href={installmentPath} className={`block ${coholdUi.secondaryBtn}`}>
          Make payment
        </Link>
      ) : null}

      {positionAgg?.firstInvestmentId ? (
        <Link
          href={`/dashboard/portfolio/${positionAgg.firstInvestmentId}`}
          className="block text-center text-sm font-medium text-cohold-primary"
        >
          View your investment
        </Link>
      ) : null}

      {meLoading ? (
        <p className={`text-center ${coholdUi.riskNote}`}>Checking KYC status…</p>
      ) : !kycAllowed ? (
        <p className={`text-center ${coholdUi.riskNote}`}>
          Money actions are available only after your KYC status is VERIFIED.
        </p>
      ) : null}

      {isFractional ? (
        <p className={coholdUi.riskNote}>Projected yield is an estimate, not a guarantee. Capital is at risk.</p>
      ) : null}

      {stickyCta ? <StickyBottomBar>{stickyCta}</StickyBottomBar> : null}
    </div>
  );
}
