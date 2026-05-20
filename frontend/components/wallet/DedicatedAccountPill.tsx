'use client';

import Link from 'next/link';
import type { DedicatedAccountPillState } from '@/lib/wallet/dedicated-account-display';

type DedicatedAccountPillProps = {
  state: DedicatedAccountPillState;
  onClick?: () => void;
};

const pillBase =
  'inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-center text-xs font-medium transition-colors';

const pillNeutral = `${pillBase} border-[#DDD8D2] bg-[#FAF8F5] text-[#171717]`;
const pillWarning = `${pillBase} border-amber-200/90 bg-amber-50 text-amber-950`;
const pillMuted = `${pillBase} border-[#DDD8D2] bg-white/80 text-dashboard-body`;

function BankIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M3 10h18M5 10V7l7-4 7 4v3M6 10v8h2v-8H6zm5 0v8h2v-8h-2zm5 0v8h2v-8h-2zM4 18h16v2H4v-2z"
      />
    </svg>
  );
}

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

export function DedicatedAccountPill({ state, onClick }: DedicatedAccountPillProps) {
  if (state.kind === 'loading') {
    return (
      <span className={pillMuted} aria-busy="true">
        Loading account…
      </span>
    );
  }

  if (state.kind === 'kyc_required') {
    return (
      <Link href="/dashboard/kyc" className={`${pillNeutral} hover:bg-[#F5F1EB]`}>
        Complete KYC to get your account
      </Link>
    );
  }

  if (state.kind === 'provisioning') {
    return <span className={pillMuted}>Account provisioning…</span>;
  }

  if (state.kind === 'retry') {
    return (
      <button type="button" onClick={onClick} className={`${pillWarning} hover:bg-amber-100/90`}>
        Account setup needs retry
      </button>
    );
  }

  if (state.kind === 'unavailable') {
    return <span className={pillMuted}>Account unavailable</span>;
  }

  if (state.kind === 'active' && state.maskedLabel) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${pillNeutral} hover:bg-[#F5F1EB]`}
        aria-label={`Dedicated account ${state.maskedLabel}, view details`}
      >
        <BankIcon className="h-4 w-4 shrink-0 text-[#054870]" />
        <span className="truncate font-medium">{state.maskedLabel}</span>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-dashboard-muted" />
      </button>
    );
  }

  return <span className={pillMuted}>Account unavailable</span>;
}
