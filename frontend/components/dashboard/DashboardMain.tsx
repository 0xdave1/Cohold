'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

export function DashboardMain({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const wideContent = pathname.startsWith('/dashboard/support');

  return (
    <main className="flex-1 pb-20 md:pb-6">
      <div
        className={
          wideContent
            ? 'p-4 md:p-6 max-w-3xl mx-auto w-full'
            : 'p-4 md:p-6 max-w-2xl mx-auto w-full'
        }
      >
        {children}
      </div>
    </main>
  );
}
