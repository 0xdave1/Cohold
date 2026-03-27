'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

interface AccountSettingRowProps {
  href?: string;
  onClick?: () => void;
  icon: ReactNode;
  label: string;
  tag?: string;
  destructive?: boolean;
}

export function AccountSettingRow({
  href,
  onClick,
  icon,
  label,
  tag,
  destructive = false,
}: AccountSettingRowProps) {
  const baseClasses =
    'flex w-full items-center gap-3 rounded-xl border border-dashboard-border bg-dashboard-card px-4 py-3 text-left transition-colors hover:opacity-90';
  const textClasses = destructive ? 'text-red-600' : 'text-dashboard-heading';

  const content = (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cohold-icon-bg text-dashboard-heading">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className={textClasses}>{label}</span>
        {tag != null && tag !== '' && (
          <span className="ml-2 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            {tag}
          </span>
        )}
      </span>
      <svg
        className="h-5 w-5 shrink-0 text-dashboard-muted"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </>
  );

  if (href != null) {
    return (
      <Link href={href} className={`${baseClasses} ${textClasses}`}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={`${baseClasses} ${textClasses}`}>
      {content}
    </button>
  );
}
