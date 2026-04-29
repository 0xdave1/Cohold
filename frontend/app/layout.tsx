import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { Providers } from '@/lib/providers';

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'https://cohold.co';

export const viewport: Viewport = {
  themeColor: '#00406C',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  colorScheme: 'light',
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: 'Cohold',
  title: {
    default: 'Cohold',
    template: '%s | Cohold',
  },
  description:
    'Fractional real estate investing — build wealth with property-backed assets, wallet, and portfolio tools from Cohold.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Cohold',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/icon-180.png', sizes: '180x180', type: 'image/png' }],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-background text-foreground antialiased touch-manipulation">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
