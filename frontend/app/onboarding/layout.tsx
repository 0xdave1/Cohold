import type { ReactNode } from 'react';
import { OnboardingGuard } from '@/components/onboarding/OnboardingGuard';
import { OnboardingBackLink } from '@/components/onboarding/OnboardingBackLink';
import { OnboardingProgress } from '@/components/onboarding/OnboardingProgress';

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <OnboardingGuard>
      <div className="flex min-h-screen flex-col bg-cohold-bg">
        <header className="flex items-center justify-between gap-3 px-3 py-3 sm:px-4">
          <OnboardingBackLink />
          <OnboardingProgress />
        </header>
        <main className="flex flex-1 items-center justify-center px-3 py-4 sm:px-4 sm:py-6">
          <div className="w-full sm:max-w-[400px]">{children}</div>
        </main>
      </div>
    </OnboardingGuard>
  );
}
