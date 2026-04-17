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
            ? 'w-full px-4 py-4 md:px-6 md:py-6 md:max-w-3xl md:mx-auto'
            : 'w-full px-4 py-4 md:px-6 md:py-6 md:max-w-2xl md:mx-auto'
        }
      >
        {children}
      </div>
    </main>
  );
}
