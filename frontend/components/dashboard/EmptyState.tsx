'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

type Cta =
  | { label: string; href: string }
  | { label: string; onClick: () => void };

export type EmptyStateProps = {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  message?: string;
  cta?: Cta;
  variant?: 'card' | 'modal';
  className?: string;
};

export function EmptyState({
  title,
  subtitle,
  icon,
  message,
  cta,
  variant = 'card',
  className = '',
}: EmptyStateProps) {
  const wrapperBase =
    variant === 'card'
      ? 'rounded-2xl border border-dashboard-border bg-dashboard-card p-8 text-center'
      : 'text-center';

  const Wrapper = (
    <div
      className={`${wrapperBase} ${className}`}
    >
      {icon && (
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F5D99A]">
          <div className="text-cohold-blue">{icon}</div>
        </div>
      )}

      <h2 className="mt-4 text-sm font-semibold text-dashboard-heading">{title}</h2>
      {subtitle && (
        <p className="mt-1 text-xs font-normal text-dashboard-body whitespace-pre-line">{subtitle}</p>
      )}
      {message && (
        <p className="mt-2 text-xs font-normal leading-5 text-dashboard-body whitespace-pre-line">
          {message}
        </p>
      )}

      {cta && (
        <div className="mt-6">
          {'href' in cta ? (
            <Link
              href={cta.href}
              className="inline-flex h-11 w-full items-center justify-center rounded-full bg-cohold-blue px-4 text-sm font-medium text-white hover:opacity-90"
            >
              {cta.label}
            </Link>
          ) : (
            <button
              type="button"
              onClick={cta.onClick}
              className="inline-flex h-11 w-full items-center justify-center rounded-full bg-cohold-blue px-4 text-sm font-medium text-white hover:opacity-90"
            >
              {cta.label}
            </button>
          )}
        </div>
      )}
    </div>
  );

  return Wrapper;
}

