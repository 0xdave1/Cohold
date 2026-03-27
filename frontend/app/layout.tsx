import type { ReactNode } from 'react';
import './globals.css';
import { Providers } from '@/lib/providers';

export const metadata = {
  title: 'Cohold',
  description: 'Collaborative fractional real estate investing',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

