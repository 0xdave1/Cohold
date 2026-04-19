'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import Image from 'next/image';
import { usePropertyDetails } from '@/lib/hooks/use-properties';
import { useMyInvestments } from '@/lib/hooks/use-investments';
import { formatMoney } from '@/lib/hooks/use-wallet';
import { detectListingMode } from '@/lib/listings/category';
import { investmentPositionValue } from '@/lib/money/portfolio';
import { buyPreviewFromShares } from '@/lib/money/buy-preview';
import { formatAnnualYieldPercent } from '@/lib/format/yield';
import { INVESTMENT_FEE_RATE } from '@/lib/constants/investment';
import { BackIconButton, DetailRow, ListingHero, PrimaryButton, SectionCard } from '../_components/listing-ui';
import Decimal from 'decimal.js';

export default function PropertyDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const { data: property, isLoading } = usePropertyDetails(id);
  const { data: myInvestments } = useMyInvestments(1, 100);

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
    return <div className="animate-pulse rounded-xl bg-dashboard-border/60 h-64" />;
  }

  const modeFromQuery = searchParams.get('mode');
  const mode =
    modeFromQuery === 'fractional' || modeFromQuery === 'land' || modeFromQuery === 'own-home'
      ? modeFromQuery
      : detectListingMode(property.title, property.description);

  const sharePrice = property.sharePrice ?? property.totalValue;
  const sharesTotal = property.sharesTotal ?? '0';
  const sharesSold = property.sharesSold ?? '0';
  const progress = Number(property.fundingProgressPercent ?? '0');
  const progressWidth = `${Math.max(0, Math.min(100, progress))}%`;
  const isFractional = mode === 'fractional';
  const isLand = mode === 'land';
  const primaryLabel = isFractional ? 'Invest now' : isLand ? 'Buy land' : 'Own a home';
  const secondaryLabel = isLand || mode === 'own-home' ? 'Pay installments' : null;
  const nextPath = isFractional
    ? `/dashboard/properties/${id}/invest`
    : isLand
      ? `/dashboard/properties/${id}/buy-land`
      : `/dashboard/properties/${id}/own-home`;
  const installmentPath = `/dashboard/properties/${id}/installment`;
  const investorCount = property.investments?.length ?? 0;
  const galleryImages = property.images ?? [];
  const heroImage = galleryImages[0]?.url ?? property.coverImageUrl ?? null;

  const sharesTotalNum = Number(sharesTotal);
  const sharesSoldNum = Number(sharesSold);
  const sharesLeft =
    Number.isFinite(sharesTotalNum) && Number.isFinite(sharesSoldNum)
      ? Math.max(0, sharesTotalNum - sharesSoldNum)
      : 0;
  const soldOut = sharesTotalNum > 0 && sharesSoldNum >= sharesTotalNum;

  const annualYield = property.annualYield;
  const durationLabel =
    property.duration != null && String(property.duration).trim() !== ''
      ? String(property.duration)
      : '—';

  const oneSharePreview = isFractional ? buyPreviewFromShares(String(sharePrice), '1') : null;

  const ownershipLabel =
    positionAgg != null ? `${Number(positionAgg.ownershipPercent).toFixed(2)}%` : '—';

  const investmentDateLabel =
    myInvestment?.createdAt != null
      ? new Date(myInvestment.createdAt).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
      : null;

  return (
    <div className="space-y-6">
      <div className="pt-1">
        <BackIconButton href="/dashboard/properties" />
      </div>

      <ListingHero title={property.title} imageUrl={heroImage} imageCount={galleryImages.length} />

      <div className="space-y-2">
        <h1 className="text-[28px] leading-8 font-semibold text-dashboard-heading">{property.title}</h1>
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
          <span>{property.location}</span>
        </p>
        <p className="text-xs text-dashboard-body flex items-center gap-1">
          <span>Listed partner developer</span>
          <svg className="h-3.5 w-3.5 text-emerald-600 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
          </svg>
        </p>
      </div>

      {isFractional && (
        <div className="rounded-xl border border-dashboard-border bg-dashboard-card/40 px-3 py-3 space-y-2">
          <p className="text-[11px] font-medium text-dashboard-heading">Listing</p>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="text-dashboard-body">Annual yield (target)</span>
              <p className="font-semibold text-dashboard-heading">{formatAnnualYieldPercent(annualYield)}</p>
            </div>
            <div>
              <span className="text-dashboard-body">Term</span>
              <p className="font-semibold text-dashboard-heading">{durationLabel}</p>
            </div>
          </div>
        </div>
      )}

      {isInvested && isFractional && positionAgg != null && (
        <div className="rounded-xl bg-dashboard-border/30 px-3 py-4">
          <p className="text-[10px] text-dashboard-body mb-2 text-center uppercase tracking-wide">Your position</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-[10px] text-dashboard-body">Principal</p>
              <p className="text-xs font-semibold text-dashboard-heading leading-tight">
                {formatMoney(positionAgg.amount, property.currency)}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-dashboard-body">Total returns</p>
              <p className="text-xs font-semibold text-emerald-600 leading-tight">
                {formatMoney(positionAgg.totalReturns, property.currency)}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-dashboard-body">Position value</p>
              <p className="text-xs font-semibold text-dashboard-heading leading-tight">
                {formatMoney(positionAgg.worth, property.currency)}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-dashboard-body">Ownership %</p>
              <p className="text-xs font-semibold text-dashboard-heading leading-tight">{ownershipLabel}</p>
            </div>
            <div>
              <p className="text-[10px] text-dashboard-body">Shares</p>
              <p className="text-xs font-semibold text-dashboard-heading leading-tight">{positionAgg.shares}</p>
            </div>
            {investmentDateLabel ? (
              <div>
                <p className="text-[10px] text-dashboard-body">First investment</p>
                <p className="text-xs font-semibold text-dashboard-heading leading-tight">{investmentDateLabel}</p>
              </div>
            ) : null}
          </div>
          {positionAgg.firstInvestmentId ? (
            <Link
              href={`/dashboard/portfolio/${positionAgg.firstInvestmentId}`}
              className="mt-3 block text-center text-xs font-medium text-cohold-blue"
            >
              Open portfolio details
            </Link>
          ) : null}
        </div>
      )}

      <div>
        <p className="text-xs text-dashboard-body">{isFractional ? 'Share price' : isLand ? 'Plot price' : 'Home price'}</p>
        <p className="text-[28px] leading-8 font-bold text-dashboard-heading">
          {formatMoney(isFractional ? sharePrice : property.totalValue, property.currency)}
          {isFractional ? <span className="text-xs font-normal text-dashboard-body"> /share</span> : null}
        </p>
      </div>

      {isFractional && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] text-dashboard-body">
            <span>Funding progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-dashboard-border">
            <div className="h-1.5 rounded-full bg-[#E3AA2B]" style={{ width: progressWidth }} />
          </div>
          <div className="flex justify-between text-[11px] text-dashboard-body">
            <span>
              {sharesSold} / {sharesTotal} shares sold
            </span>
            <span className="font-medium text-dashboard-heading">{sharesLeft} left</span>
          </div>
          {sharesLeft > 0 && sharesLeft <= sharesTotalNum * 0.1 ? (
            <p className="text-[11px] text-amber-700">Limited availability</p>
          ) : null}
        </div>
      )}

      {isFractional && oneSharePreview && (
        <div className="rounded-xl border border-dashed border-dashboard-border px-3 py-3">
          <p className="text-[11px] font-medium text-dashboard-heading mb-2">Cost preview (1 share)</p>
          <div className="space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span className="text-dashboard-body">Principal</span>
              <span>{formatMoney(oneSharePreview.principal, property.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-dashboard-body">Fee ({INVESTMENT_FEE_RATE * 100}%)</span>
              <span>{formatMoney(oneSharePreview.fee, property.currency)}</span>
            </div>
            <div className="flex justify-between font-semibold pt-1 border-t border-dashboard-border/60">
              <span>Total charge</span>
              <span>{formatMoney(oneSharePreview.totalCharge, property.currency)}</span>
            </div>
          </div>
        </div>
      )}

      {isFractional && isInvested ? (
        <div className="grid grid-cols-2 gap-2">
          <Link
            href={`/dashboard/properties/${id}/sell`}
            className="flex h-11 w-full items-center justify-center rounded-full bg-dashboard-border/60 px-4 text-sm font-medium text-dashboard-heading"
          >
            Sell shares
          </Link>
          {soldOut ? (
            <span className="flex h-11 w-full items-center justify-center rounded-full bg-dashboard-border/50 px-4 text-sm font-medium text-dashboard-body">
              Fully funded
            </span>
          ) : (
            <Link href={`/dashboard/properties/${id}/invest`} className="block">
              <span className="flex h-11 w-full items-center justify-center rounded-full bg-cohold-blue px-4 text-sm font-medium text-white">
                Buy more shares
              </span>
            </Link>
          )}
        </div>
      ) : isFractional && !isInvested ? (
        <div className="grid grid-cols-2 gap-2">
          {soldOut ? (
            <span className="col-span-2 flex h-11 w-full items-center justify-center rounded-full bg-dashboard-border/50 px-4 text-sm font-medium text-dashboard-body">
              Offering closed (all shares allocated)
            </span>
          ) : (
            <Link
              href={nextPath}
              className="col-span-2 flex h-11 w-full items-center justify-center rounded-full bg-cohold-blue px-4 text-sm font-medium text-white"
            >
              Invest now
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <button type="button" className="h-10 rounded-full bg-dashboard-border/60 text-sm font-medium text-cohold-blue">
            Chat with us
          </button>
          <button
            type="button"
            className="h-10 w-10 rounded-full border border-dashboard-border bg-dashboard-card flex items-center justify-center"
          >
            <svg className="h-4 w-4 text-dashboard-body" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10l7-7m0 0h-6m6 0v6M10 14l-7 7m0 0h6m-6 0v-6" />
            </svg>
          </button>
        </div>
      )}

      <SectionCard title={isFractional ? 'Property investment details' : isLand ? 'Land details' : 'Property ownership details'}>
        <DetailRow label={isFractional ? 'Min. investment amount' : 'Min. payment'} value={formatMoney(property.minInvestment ?? '0', property.currency)} />
        <DetailRow
          label={isFractional ? 'Share price' : isLand ? 'Plot size' : 'Home amount'}
          value={isLand ? '300sqm' : formatMoney(sharePrice, property.currency)}
        />
        <DetailRow label="Annual yield (target)" value={isFractional ? formatAnnualYieldPercent(annualYield) : '—'} />
        <DetailRow label="Term" value={durationLabel} />
        {isInvested && isFractional && positionAgg ? (
          <>
            <DetailRow label="Your total returns" value={formatMoney(positionAgg.totalReturns, property.currency)} />
            <DetailRow label="ROI frequency" value="Monthly" />
          </>
        ) : null}
        {investmentDateLabel && isFractional ? <DetailRow label="Investment date" value={investmentDateLabel} /> : null}
        <DetailRow label={isFractional ? 'No. of investors' : 'Payment frequency'} value={isFractional ? String(investorCount) : 'Monthly'} />
        <DetailRow label={isFractional ? 'Total shares' : 'Payment duration'} value={sharesTotal} />
        {!isFractional && <DetailRow label="Total investment worth" value={formatMoney(property.totalValue, property.currency)} />}
      </SectionCard>

      <SectionCard title={isLand ? 'Land description' : 'Property description'}>
        <p className="text-xs leading-5 text-dashboard-body">
          {property.description || 'No description provided yet for this listing.'}
        </p>
      </SectionCard>

      <SectionCard title={isLand ? 'Land features' : 'Property features'}>
        <div className="flex flex-wrap gap-1.5">
          {['Electricity', 'Security', 'Internet connectivity', 'Accessibility', 'Proximate to recreation spots', 'Modern style'].map((f) => (
            <span key={f} className="rounded-full border border-dashboard-border px-2.5 py-1 text-[10px] text-dashboard-body">
              {f}
            </span>
          ))}
        </div>
      </SectionCard>

      <SectionCard title={isLand ? 'Land gallery' : 'Property gallery'}>
        {galleryImages.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {galleryImages.map((img) => (
              <a
                key={img.id}
                href={img.url}
                target="_blank"
                rel="noopener noreferrer"
                className="relative block h-24 overflow-hidden rounded-lg border border-dashboard-border"
              >
                <Image
                  src={img.url}
                  alt={img.altText ?? property.title}
                  fill
                  sizes="200px"
                  className="h-full w-full object-cover"
                  unoptimized
                />
              </a>
            ))}
          </div>
        ) : (
          <p className="text-xs text-dashboard-body">No property images uploaded yet.</p>
        )}
      </SectionCard>

      <SectionCard title={isLand ? 'Land documents' : 'Property documents'}>
        <div className="space-y-2">
          {(property.documents ?? []).slice(0, 6).map((d) => (
            <a
              key={d.id}
              href={d.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-lg border border-dashboard-border px-3 py-2"
            >
              <div>
                <p className="text-xs font-medium text-dashboard-heading">{d.type}</p>
                <p className="text-[10px] text-dashboard-body">PDF</p>
              </div>
              <svg className="h-4 w-4 text-dashboard-body" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10l7-7m0 0h-6m6 0v6M10 14l-7 7m0 0h6m-6 0v-6" />
              </svg>
            </a>
          ))}
          {(!property.documents || property.documents.length === 0) && (
            <p className="text-xs text-dashboard-body">No documents uploaded yet.</p>
          )}
        </div>
      </SectionCard>

      {!(isInvested && isFractional) && !isFractional && (
        <div className="grid grid-cols-2 gap-2 pt-1">
          {secondaryLabel ? (
            <Link href={installmentPath}>
              <button type="button" className="h-11 w-full rounded-full bg-dashboard-border/60 text-sm font-medium text-dashboard-heading">
                {secondaryLabel}
              </button>
            </Link>
          ) : (
            <div />
          )}
          <Link href={nextPath}>
            <PrimaryButton>{primaryLabel}</PrimaryButton>
          </Link>
        </div>
      )}
    </div>
  );
}
