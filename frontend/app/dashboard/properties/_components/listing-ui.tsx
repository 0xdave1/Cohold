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

type HeroImage = {
  id: string;
  url: string;
  altText?: string | null;
};

export function BackIconButton({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-dashboard-border bg-dashboard-card"
      aria-label="Go back"
    >
      <svg className="h-4 w-4 text-dashboard-heading" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
}: {
  title: string;
  images?: HeroImage[];
  imageUrl?: string | null;
  imageCount?: number;
}) {
  const validImages = (images ?? []).filter((img) => Boolean(img.url));
  const fallbackImage =
    validImages.length === 0 && imageUrl
      ? [{ id: 'fallback', url: imageUrl, altText: title }]
      : validImages;
  const total = imageCount > 0 ? imageCount : fallbackImage.length;
  const [activeIndex, setActiveIndex] = useState(1);

  return (
    <div className="relative h-44 overflow-hidden rounded-xl bg-dashboard-border/70">
      {fallbackImage.length > 0 ? (
        <>
          <Swiper
            modules={[Pagination, Navigation]}
            pagination={{ clickable: true }}
            navigation
            className="h-full w-full"
            onSlideChange={(swiper) => setActiveIndex(swiper.realIndex + 1)}
          >
            {fallbackImage.map((img) => (
              <SwiperSlide key={img.id}>
                <Image
                  src={img.url}
                  alt={img.altText ?? title}
                  fill
                  sizes="100vw"
                  className="h-full w-full object-cover"
                  unoptimized
                />
              </SwiperSlide>
            ))}
          </Swiper>
          {total > 1 ? (
            <div className="pointer-events-none absolute right-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-medium text-dashboard-heading">
              {activeIndex}/{total}
            </div>
          ) : null}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/0 to-black/20" />
        </>
      ) : (
        <div className="h-full w-full bg-[linear-gradient(135deg,#8a8a8a,#d1d1d1)]" />
      )}
      <span className="sr-only">{title}</span>
    </div>
  );
}

export function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-medium text-dashboard-body">{title}</h3>
      <div className="rounded-xl border border-dashboard-border bg-dashboard-card p-3">{children}</div>
    </section>
  );
}

export function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <span className="text-xs text-dashboard-body">{label}</span>
      <span className="text-xs font-medium text-dashboard-heading">{value}</span>
    </div>
  );
}

export function PrimaryButton({
  children,
  className = '',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`h-11 w-full rounded-full bg-cohold-blue px-4 text-sm font-medium text-white disabled:opacity-50 ${className}`}
    >
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
    <button
      {...rest}
      className={`h-11 w-full rounded-full bg-dashboard-border/60 px-4 text-sm font-medium text-dashboard-heading ${className}`}
    >
      {children}
    </button>
  );
}
