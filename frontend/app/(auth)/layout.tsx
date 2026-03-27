import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-auth-bg px-4 py-8">
      <div className="w-full max-w-[400px]">{children}</div>
    </div>
  );
}
