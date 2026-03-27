'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const steps: { path: string; backHref: string; backLabel: string }[] = [
  { path: '/onboarding/personal-details', backHref: '/login', backLabel: 'Back to login' },
  { path: '/onboarding/residential-details', backHref: '/onboarding/personal-details', backLabel: 'Back' },
  { path: '/onboarding/review', backHref: '/onboarding/residential-details', backLabel: 'Back' },
  { path: '/onboarding/success', backHref: '/onboarding/review', backLabel: 'Back' },
];

export function OnboardingBackLink() {
  const pathname = usePathname();
  const step = steps.find((s) => s.path === pathname) ?? steps[0];

  return (
    <Link
      href={step.backHref}
      className="text-auth-heading hover:text-cohold-blue flex items-center gap-1 text-sm font-medium"
      aria-label={step.backLabel}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
      {step.backLabel === 'Back' ? 'Back' : 'Back to login'}
    </Link>
  );
}
