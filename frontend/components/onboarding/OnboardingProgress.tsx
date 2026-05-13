'use client';

import { usePathname } from 'next/navigation';

const STEP_INDEX: Record<string, number> = {
  '/onboarding/personal-details': 0,
  '/onboarding/residential-details': 1,
  '/onboarding/review': 2,
};

const TOTAL = 3;

export function OnboardingProgress() {
  const pathname = usePathname();
  const step = STEP_INDEX[pathname];
  if (step === undefined) return null;

  const pct = ((step + 1) / TOTAL) * 100;

  return (
    <div className="flex min-w-[100px] max-w-[140px] flex-1 flex-col items-end gap-1 sm:min-w-[120px]">
      <span className="text-[11px] font-medium text-cohold-muted">
        {step + 1}/{TOTAL}
      </span>
      <div className="h-1 w-full overflow-hidden rounded-full bg-white/80 ring-1 ring-cohold-border/60">
        <div
          className="h-full rounded-full bg-cohold-primary transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
