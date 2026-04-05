'use client';

import type { ReactNode } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { RedirectIfNotOnboarded } from '@/components/dashboard/RedirectIfNotOnboarded';
import { DashboardBottomNav } from '@/components/dashboard/DashboardBottomNav';
import { DashboardMain } from '@/components/dashboard/DashboardMain';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  if (!hasHydrated) {
    return null; // prevent hydration mismatch
  }

  return (
    <RedirectIfNotOnboarded>
      <div className="min-h-screen flex flex-col bg-dashboard-bg text-dashboard-heading">
        <DashboardMain>{children}</DashboardMain>
        <DashboardBottomNav />
      </div>
    </RedirectIfNotOnboarded>
  );
}