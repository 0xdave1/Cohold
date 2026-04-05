import type { MetadataRoute } from 'next';

/**
 * Web app manifest for installability (Chrome, Edge, Samsung Internet, Safari 16.4+).
 * Theme/background colors match Cohold brand tokens.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Cohold',
    short_name: 'Cohold',
    description:
      'Cohold — fractional real estate investing and proptech fintech. Invest in property-backed assets, manage your wallet, and grow your portfolio.',
    start_url: '/login',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    theme_color: '#00406C',
    background_color: '#F7F4F0',
    categories: ['finance', 'business'],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
