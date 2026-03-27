'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

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

export function ListingHero({ title, slideLabel = '1/5' }: { title: string; slideLabel?: string }) {
  return (
    <div className="relative h-44 overflow-hidden rounded-xl bg-dashboard-border/70">
      <div className="absolute inset-0 bg-gradient-to-b from-black/0 to-black/20" />
      <div className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-medium text-dashboard-heading">
        {slideLabel}
      </div>
      <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            className={`h-1.5 w-1.5 rounded-full ${i === 1 ? 'bg-white' : 'bg-white/60'}`}
            aria-hidden
          />
        ))}
      </div>
      <div className="h-full w-full bg-[linear-gradient(135deg,#8a8a8a,#d1d1d1)]" />
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
