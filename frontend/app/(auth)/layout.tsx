import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-cohold-bg px-3 py-6 sm:px-4 sm:py-8">
      <div className="w-full sm:max-w-[400px]">{children}</div>
    </div>
  );
}
