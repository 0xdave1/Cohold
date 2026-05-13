'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import type { OnboardingChecklist } from '@/lib/hooks/use-onboarding-checklist';
import { buildDashboardTodoShortcuts } from '@/lib/dashboard/dashboard-todos';
import { safeDebugLog } from '@/lib/logging/safe-debug';

type Props = {
  checklist: OnboardingChecklist | undefined;
  isLoading: boolean;
  isError: boolean;
};

function TodoIcon({ id }: { id: string }) {
  const cls = 'h-5 w-5 text-cohold-accent';
  switch (id) {
    case 'email':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      );
    case 'profile':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" />
        </svg>
      );
    case 'kyc':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5M10 6V4a2 2 0 114 0v2M10 6h4" />
        </svg>
      );
    case 'va':
    case 'fund':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      );
    case 'browse':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      );
    case 'support':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      );
    case 'notifications':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      );
    default:
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      );
  }
}

export function DashboardTodoShortcuts({ checklist, isLoading, isError }: Props) {
  useEffect(() => {
    if (isError) {
      safeDebugLog('dashboard.home.onboarding-checklist', { fallback: 'default-todos' });
    }
  }, [isError]);

  if (isLoading) {
    return (
      <section aria-busy="true" aria-label="To-dos loading" className="space-y-2">
        <p className="text-xs font-normal text-dashboard-body">To-dos</p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="min-h-[104px] min-w-[108px] flex-1 animate-pulse rounded-xl border border-dashboard-border bg-dashboard-card"
            />
          ))}
        </div>
      </section>
    );
  }

  const items = buildDashboardTodoShortcuts(checklist, { isError });

  return (
    <section aria-label="To-dos">
      <p className="mb-2 text-xs font-normal text-dashboard-body">To-dos</p>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {items.map((t) => (
          <Link
            key={`${t.id}-${t.href}`}
            href={t.href}
            className="flex min-h-[104px] min-w-[112px] max-w-[140px] flex-shrink-0 flex-col justify-between rounded-xl border border-cohold-border bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-shadow hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] focus:outline-none focus:ring-2 focus:ring-cohold-primary/25"
          >
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-cohold-accent-border bg-cohold-accent-soft"
              aria-hidden
            >
              <TodoIcon id={t.id} />
            </div>
            <div className="mt-2 flex items-end justify-between gap-1">
              <p className="line-clamp-3 text-[11px] font-medium leading-snug text-dashboard-heading">{t.title}</p>
              <svg className="h-3.5 w-3.5 shrink-0 text-dashboard-body" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
