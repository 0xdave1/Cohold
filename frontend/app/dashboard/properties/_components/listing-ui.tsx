'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useState } from 'react';
import Image from 'next/image';
import { Navigation, Pagination } from 'swiper/modules';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import { listingTypePillLabel, resolveListingMode } from '@/lib/listings/category';
import type { ListingMode } from '@/lib/listings/category';
import type { Property } from '@/lib/hooks/use-properties';
import { formatMoney } from '@/lib/hooks/use-wallet';
import { formatAnnualYieldPercent } from '@/lib/format/yield';
import { formatTermForListingCard } from '@/lib/listings/format-term';
import { titleVerificationSubtitleForCard } from '@/lib/listings/legal-status-ui';
import { shortLocationForListingCard } from '@/lib/listings/display-location';

type HeroImage = {
  id: string;
  url: string;
  altText?: string | null;
};

/** Shared Cohold listing / property UI tokens (Figma). */
export const coholdUi = {
  page: 'space-y-4',
  card: 'overflow-hidden rounded-2xl border border-cohold-border bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)]',
  cardInner: 'rounded-2xl border border-cohold-border bg-white p-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]',
  heading: 'text-cohold-text',
  body: 'text-cohold-muted',
  primaryBtn:
    'flex h-11 w-full items-center justify-center rounded-full bg-cohold-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-cohold-primary-hover disabled:opacity-50',
  secondaryBtn:
    'flex h-11 w-full items-center justify-center rounded-full border border-cohold-border bg-white px-4 text-sm font-medium text-cohold-text',
  ghostBtn:
    'flex h-11 w-full items-center justify-center rounded-full bg-cohold-bg px-4 text-sm font-medium text-cohold-primary',
  filterActive: 'border-cohold-accent-border bg-cohold-accent-soft text-cohold-text',
  filterIdle: 'border-cohold-border bg-white text-cohold-muted',
  chip: 'rounded-full border border-cohold-border bg-cohold-bg px-2.5 py-1 text-[10px] text-cohold-muted',
  riskNote: 'text-[10px] leading-relaxed text-cohold-muted',
} as const;

export function ListingPageShell({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`${coholdUi.page} ${className}`.trim()}>{children}</div>;
}

export function ListingSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`${coholdUi.card} h-[280px] animate-pulse bg-cohold-border/40`} />
      ))}
    </div>
  );
}

export function ListingEmptyState({
  title,
  message,
  actionHref,
  actionLabel,
}: {
  title: string;
  message: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className={`${coholdUi.cardInner} py-10 text-center`}>
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-cohold-accent-border bg-cohold-accent-soft">
        <svg className="h-8 w-8 text-cohold-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 21h18M4 21V11l8-6 8 6v10M9 21V15h6v6" />
        </svg>
      </div>
      <p className="text-sm font-semibold text-cohold-text">{title}</p>
      <p className="mx-auto mt-2 max-w-[260px] text-xs leading-5 text-cohold-muted">{message}</p>
      {actionHref && actionLabel ? (
        <Link href={actionHref} className={`mx-auto mt-5 block max-w-[220px] ${coholdUi.primaryBtn}`}>
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

export function FilterChip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        active ? coholdUi.filterActive : coholdUi.filterIdle
      }`}
    >
      {children}
    </button>
  );
}

const categoryPillStyles: Record<string, string> = {
  FRACTIONAL_OWNERSHIP: 'bg-[#D6EDF8] text-[#0A4A74]',
  LAND_ACQUISITION: 'bg-cohold-accent-soft text-[#7A5A12]',
  OWN_A_HOME: 'bg-[#E8E4DF] text-cohold-text',
};

export function CategoryPill({
  listingType,
  mode,
}: {
  listingType?: string | null;
  mode?: ListingMode;
}) {
  const label = listingType
    ? listingTypePillLabel(listingType)
    : mode === 'land'
      ? 'Land'
      : mode === 'own-home'
        ? 'Ownership'
        : 'Fractional';
  const key =
    listingType ?? (mode === 'land' ? 'LAND_ACQUISITION' : mode === 'own-home' ? 'OWN_A_HOME' : 'FRACTIONAL_OWNERSHIP');
  const style = categoryPillStyles[key] ?? categoryPillStyles.FRACTIONAL_OWNERSHIP;
  return <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${style}`}>{label}</span>;
}

export function ActiveStatusPill() {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-900">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
      Active
    </span>
  );
}

export function TitleVerifiedPill() {
  return (
    <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-800">Title verified</span>
  );
}

export function SoldOutPill() {
  return (
    <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-900">
      Sold out
    </span>
  );
}

export function BackIconButton({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-cohold-border bg-white shadow-sm"
      aria-label="Go back"
    >
      <svg className="h-4 w-4 text-cohold-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
    </Link>
  );
}

export function ListingHero({
  title,
  images,
  imageUrl,
  imageCount = 0,
  tall = false,
}: {
  title: string;
  images?: HeroImage[];
  imageUrl?: string | null;
  imageCount?: number;
  tall?: boolean;
}) {
  const validImages = (images ?? []).filter((img) => Boolean(img.url));
  const fallbackImage =
    validImages.length === 0 && imageUrl ? [{ id: 'fallback', url: imageUrl, altText: title }] : validImages;
  const total = imageCount > 0 ? imageCount : fallbackImage.length;
  const [activeIndex, setActiveIndex] = useState(1);
  const height = tall ? 'h-52' : 'h-44';

  return (
    <div className={`relative ${height} overflow-hidden rounded-2xl bg-cohold-border/60`}>
      {fallbackImage.length > 0 ? (
        <>
          <Swiper
            modules={[Pagination, Navigation]}
            pagination={{ clickable: true }}
            navigation
            className="h-full w-full [&_.swiper-pagination-bullet-active]:bg-cohold-accent"
            onSlideChange={(swiper) => setActiveIndex(swiper.realIndex + 1)}
          >
            {fallbackImage.map((img) => (
              <SwiperSlide key={img.id} className="relative h-full">
                <Image
                  src={img.url}
                  alt={img.altText ?? title}
                  fill
                  sizes="100vw"
                  className="object-cover"
                  unoptimized
                />
              </SwiperSlide>
            ))}
          </Swiper>
          {total > 1 ? (
            <span className="pointer-events-none absolute right-2 top-2 rounded-full bg-white/95 px-2.5 py-0.5 text-[10px] font-semibold text-cohold-text shadow-sm">
              {activeIndex}/{total}
            </span>
          ) : null}
        </>
      ) : (
        <div className="h-full w-full bg-gradient-to-br from-cohold-border to-cohold-bg" />
      )}
      <span className="sr-only">{title}</span>
    </div>
  );
}

export function GoldProgressBar({ percent, label = 'Investment progress' }: { percent: number; label?: string }) {
  const width = `${Math.max(0, Math.min(100, percent))}%`;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[11px] text-cohold-muted">
        <span>{label}</span>
        <span className="font-medium text-cohold-text">{Math.round(percent)}%</span>
      </div>
      <div className="h-2 rounded-full bg-cohold-border/80">
        <div className="h-2 rounded-full bg-cohold-accent transition-all" style={{ width }} />
      </div>
    </div>
  );
}

export function InvestmentStatsCard({
  tiles,
  footer,
}: {
  tiles: { label: string; value: string }[];
  footer?: string;
}) {
  return (
    <div className={coholdUi.cardInner}>
      <div className={`grid gap-3 text-center ${tiles.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {tiles.map((t) => (
          <div key={t.label}>
            <p className="text-[10px] text-cohold-muted">{t.label}</p>
            <p className="mt-0.5 text-sm font-semibold leading-tight text-cohold-text">{t.value}</p>
          </div>
        ))}
      </div>
      {footer ? <p className="mt-3 text-center text-[10px] leading-relaxed text-cohold-muted">{footer}</p> : null}
    </div>
  );
}

export function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold text-cohold-text">{title}</h3>
      <div className={coholdUi.cardInner}>{children}</div>
    </section>
  );
}

export function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-cohold-border/60 py-2 last:border-0">
      <span className="text-xs text-cohold-muted">{label}</span>
      <span className="max-w-[58%] text-right text-xs font-medium text-cohold-text">{value}</span>
    </div>
  );
}

export function FeatureChips({ features, emptyLabel = 'No features listed yet.' }: { features: string[]; emptyLabel?: string }) {
  if (features.length === 0) {
    return <p className="text-xs text-cohold-muted">{emptyLabel}</p>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {features.map((f) => (
        <span key={f} className={coholdUi.chip}>
          {f}
        </span>
      ))}
    </div>
  );
}

export function PdfDocumentIcon() {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cohold-accent-soft">
      <svg className="h-5 w-5 text-[#9A7420]" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zM8 13h2v5H8v-5zm4-3h2v8h-2v-8zm4 3h2v5h-2v-5z" />
      </svg>
    </span>
  );
}

export function DocumentCard({ title, href, meta = 'Document' }: { title: string; href: string; meta?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-xl border border-cohold-border bg-white px-3 py-2.5 transition-colors hover:bg-cohold-bg/50"
    >
      <PdfDocumentIcon />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-cohold-text">{title}</p>
        <p className="text-[10px] text-cohold-muted">{meta}</p>
      </div>
      <svg className="h-4 w-4 shrink-0 text-cohold-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10l7-7m0 0h-6m6 0v6M10 14l-7 7m0 0h6m-6 0v-6" />
      </svg>
    </a>
  );
}

export function DocumentsSection({
  documents,
  documentsAvailable,
  title = 'Property documents',
}: {
  documents: Array<{ id: string; type: string; url: string }>;
  documentsAvailable?: boolean;
  title?: string;
}) {
  return (
    <SectionCard title={title}>
      <div className="space-y-2">
        {documents.length === 0 ? (
          <p className="text-xs text-cohold-muted">No documents uploaded yet.</p>
        ) : (
          documents.map((d) => <DocumentCard key={d.id} title={d.type} href={d.url} meta="PDF" />)
        )}
        <p className="text-[11px] text-cohold-muted">
          Document availability: {documentsAvailable ? 'Available' : 'Not specified'}
        </p>
      </div>
    </SectionCard>
  );
}

export function ChatSupportRow() {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-2">
      <Link href="/dashboard/support" className={coholdUi.ghostBtn}>
        <span className="inline-flex items-center gap-2">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          Chat with us
        </span>
      </Link>
      <button
        type="button"
        className="flex h-11 w-11 items-center justify-center rounded-full border border-cohold-border bg-white"
        aria-label="Share"
      >
        <svg className="h-4 w-4 text-cohold-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10l7-7m0 0h-6m6 0v6M10 14l-7 7m0 0h6m-6 0v-6" />
        </svg>
      </button>
    </div>
  );
}

export function StickyBottomBar({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] z-30 mx-auto max-w-lg border-t border-cohold-border bg-white/95 px-4 py-3 backdrop-blur-sm">
      {children}
    </div>
  );
}

export function PrimaryButton({
  children,
  className = '',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" {...rest} className={`${coholdUi.primaryBtn} ${className}`}>
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  className = '',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" {...rest} className={`${coholdUi.secondaryBtn} ${className}`}>
      {children}
    </button>
  );
}

export function LocationPinLine({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-1 text-xs text-cohold-muted">
      <svg className="mt-0.5 h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
      <span>{children}</span>
    </p>
  );
}

export function DeveloperLine({ name, isPartner }: { name: string; isPartner?: boolean }) {
  return (
    <p className="flex flex-wrap items-center gap-1 text-xs text-cohold-muted">
      <span>by {name}</span>
      {isPartner ? (
        <svg className="h-3.5 w-3.5 text-emerald-600" viewBox="0 0 24 24" fill="currentColor" aria-label="Listed partner developer">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
        </svg>
      ) : null}
    </p>
  );
}

/** Horizontal snap row for dashboard home / carousels. */
export function ListingCarouselRow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 ${className}`.trim()}>
      {children}
    </div>
  );
}

function listingCardCtaLabel(category: ListingMode): string {
  if (category === 'fractional') return 'Invest';
  if (category === 'land') return 'Buy';
  return 'Own a home';
}

/** Figma-aligned listing card (full width or carousel slot). */
export function PropertyListingCard({
  property,
  carousel = false,
  showRiskNote = true,
}: {
  property: Property;
  carousel?: boolean;
  showRiskNote?: boolean;
}) {
  const category = resolveListingMode(property);
  const mode = category === 'fractional' ? 'fractional' : category === 'land' ? 'land' : 'own-home';
  const cityLine = shortLocationForListingCard(property);
  const titleSubtitle = titleVerificationSubtitleForCard(property.titleVerificationStatus);
  const ctaLabel = listingCardCtaLabel(category);
  const priceLabel =
    category === 'fractional'
      ? 'Min. investment'
      : category === 'land' || category === 'own-home'
        ? 'Min. monthly payment'
        : 'Min. investment';
  const priceValue =
    category === 'fractional'
      ? formatMoney(property.minInvestment ?? '0', property.currency)
      : formatMoney(property.minInvestment ?? property.totalValue, property.currency);

  const metaParts: string[] = [];
  if (cityLine) metaParts.push(cityLine);
  if (category === 'fractional') {
    metaParts.push(formatAnnualYieldPercent(property.annualYield));
    metaParts.push(formatTermForListingCard(property.termMonths));
  } else if (titleSubtitle) {
    metaParts.push(titleSubtitle);
  }

  return (
    <Link
      href={`/dashboard/properties/${property.id}?mode=${mode}`}
      className={`${coholdUi.card} block ${carousel ? 'w-[260px] flex-shrink-0 snap-start' : ''}`}
    >
      <div className={`relative bg-cohold-border/50 ${carousel ? 'h-32' : 'h-40'}`}>
        {property.coverImageUrl ? (
          <Image
            src={property.coverImageUrl}
            alt={property.title}
            fill
            sizes={carousel ? '260px' : '(max-width: 768px) 100vw, 600px'}
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-cohold-border to-cohold-bg text-xs text-cohold-muted">
            No image
          </div>
        )}
        <div className="absolute left-2 top-2 flex flex-wrap gap-1.5">
          <CategoryPill listingType={property.listingType} mode={category} />
          <ActiveStatusPill />
          {property.titleVerificationStatus?.toUpperCase() === 'VERIFIED' ? <TitleVerifiedPill /> : null}
        </div>
      </div>
      <div className={carousel ? 'p-3' : 'p-3.5'}>
        <p className={`font-semibold leading-snug text-cohold-text line-clamp-2 ${carousel ? 'text-sm' : 'text-base'}`}>
          {property.title}
        </p>
        {metaParts.length > 0 ? (
          <p className="mt-1 text-xs text-cohold-muted">{metaParts.join('  ·  ')}</p>
        ) : null}
        <div className="mt-2.5 flex items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] text-cohold-muted">{priceLabel}</p>
            <p className={`font-bold leading-tight text-cohold-text ${carousel ? 'text-lg' : 'text-xl'}`}>{priceValue}</p>
          </div>
          <span className="shrink-0 text-xs font-semibold text-cohold-primary">
            {ctaLabel} →
          </span>
        </div>
        {showRiskNote && category === 'fractional' ? (
          <p className={`mt-1.5 ${coholdUi.riskNote}`}>Projected yield is an estimate, not a guarantee.</p>
        ) : null}
      </div>
    </Link>
  );
}

export function HomeListingSection({
  title,
  seeAllHref,
  properties,
  emptyMessage = 'No listings yet',
}: {
  title: string;
  seeAllHref: string;
  properties: Property[];
  emptyMessage?: string;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-cohold-text">{title}</h2>
        <Link href={seeAllHref} className="text-sm font-normal text-cohold-muted">
          See all →
        </Link>
      </div>
      {properties.length === 0 ? (
        <div className={`${coholdUi.cardInner} py-6 text-center text-sm text-cohold-muted`}>{emptyMessage}</div>
      ) : (
        <ListingCarouselRow>
          {properties.map((p) => (
            <PropertyListingCard key={p.id} property={p} carousel showRiskNote={false} />
          ))}
        </ListingCarouselRow>
      )}
    </section>
  );
}
