'use client';

import Link from 'next/link';
import type { OnboardingChecklist } from '@/lib/hooks/use-onboarding-checklist';

type Props = {
  checklist: OnboardingChecklist | undefined;
  isLoading: boolean;
  isError: boolean;
};

function StepRow({
  done,
  label,
  hint,
}: {
  done: boolean;
  label: string;
  hint?: string;
}) {
  return (
    <li className="flex gap-2 text-sm">
      <span className="mt-0.5 shrink-0" aria-hidden>
        {done ? (
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
            ✓
          </span>
        ) : (
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-dashboard-border text-dashboard-muted text-xs">
            …
          </span>
        )}
      </span>
      <div>
        <p className={`font-medium ${done ? 'text-dashboard-body' : 'text-dashboard-heading'}`}>{label}</p>
        {hint ? <p className="text-xs text-dashboard-muted mt-0.5">{hint}</p> : null}
      </div>
    </li>
  );
}

/**
 * Informational checklist — server policies still gate money actions.
 */
export function OnboardingChecklistCard({ checklist, isLoading, isError }: Props) {
  if (isLoading) {
    return (
      <section aria-busy="true" aria-label="Onboarding checklist loading" className="rounded-xl border border-dashboard-border bg-dashboard-card p-4">
        <div className="h-4 w-40 animate-pulse rounded bg-dashboard-border/50 mb-3" />
        <div className="space-y-2">
          <div className="h-3 w-full animate-pulse rounded bg-dashboard-border/40" />
          <div className="h-3 w-[88%] animate-pulse rounded bg-dashboard-border/40" />
          <div className="h-3 w-[72%] animate-pulse rounded bg-dashboard-border/40" />
        </div>
      </section>
    );
  }

  if (isError || !checklist) {
    return (
      <section className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-950">
        <p className="font-medium text-dashboard-heading">Onboarding checklist unavailable</p>
        <p className="text-dashboard-body mt-1">Refresh the page or open Account to continue. Authorization still follows server rules.</p>
      </section>
    );
  }

  const next: { label: string; href: string; description: string } | null = (() => {
    if (!checklist.emailVerified) {
      return {
        label: 'Verify your email',
        href: '/dashboard/account',
        description: 'Complete email verification from your inbox or account security settings.',
      };
    }
    if (!checklist.profileBasicsComplete) {
      return {
        label: 'Complete profile basics',
        href: '/onboarding/personal-details',
        description: 'Add your name and phone so we can reach you.',
      };
    }
    if (!checklist.kycSubmitted) {
      return {
        label: 'Start KYC',
        href: '/dashboard/kyc',
        description: 'Submit identity details for review.',
      };
    }
    if (!checklist.kycVerified) {
      return {
        label: 'Wait for KYC review',
        href: '/dashboard/kyc',
        description: 'Your documents are being reviewed. You will be notified when the status changes.',
      };
    }
    if (!checklist.virtualAccountActive) {
      return {
        label: 'Virtual account',
        href: '/dashboard/wallet',
        description: 'Activate or retry your dedicated funding account when available.',
      };
    }
    if (!checklist.walletFunded) {
      return {
        label: 'Fund your wallet',
        href: '/dashboard/wallet',
        description: 'Add NGN through the secure checkout flow.',
      };
    }
    if (!checklist.firstInvestmentCompleted) {
      return {
        label: 'Browse properties',
        href: '/dashboard/properties',
        description: 'Pick a listing and complete your first investment.',
      };
    }
    return {
      label: 'Contact support',
      href: '/dashboard/support',
      description: 'Need help? Open a conversation with our team.',
    };
  })();

  return (
    <section className="rounded-xl border border-dashboard-border bg-dashboard-card p-4" aria-labelledby="onboarding-checklist-heading">
      <div className="flex items-start justify-between gap-2 mb-3">
        <h2 id="onboarding-checklist-heading" className="text-sm font-semibold text-dashboard-heading">
          Your setup
        </h2>
        {checklist.note ? (
          <p className="text-[10px] text-dashboard-muted max-w-[55%] text-right leading-snug">{checklist.note}</p>
        ) : null}
      </div>

      <ul className="space-y-2 mb-4" aria-label="Setup steps">
        <StepRow done={checklist.emailVerified} label="Email verified" />
        <StepRow done={checklist.profileBasicsComplete} label="Profile basics" />
        <StepRow done={checklist.kycSubmitted} label="KYC submitted" />
        <StepRow done={checklist.kycVerified} label="KYC approved" hint={checklist.kycSubmitted && !checklist.kycVerified ? 'Under review or needs action' : undefined} />
        <StepRow done={checklist.virtualAccountActive} label="Virtual account active" />
        <StepRow done={checklist.walletFunded} label="Wallet funded" />
        <StepRow done={checklist.firstInvestmentCompleted} label="First investment" />
      </ul>

      <div className="rounded-lg bg-dashboard-border/20 p-3">
        <p className="text-xs font-semibold text-dashboard-heading">Suggested next step</p>
        <p className="text-xs text-dashboard-body mt-1">{next.description}</p>
        <Link
          href={next.href}
          className="mt-2 inline-flex items-center justify-center rounded-lg bg-cohold-blue px-3 py-2 text-xs font-semibold text-white hover:opacity-90 w-full text-center"
        >
          {next.label}
        </Link>
      </div>
    </section>
  );
}
