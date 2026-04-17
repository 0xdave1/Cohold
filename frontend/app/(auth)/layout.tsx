import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-auth-bg px-3 py-8 sm:px-4">
      <div className="w-full sm:max-w-[400px]">{children}</div>
    </div>
  );
}
