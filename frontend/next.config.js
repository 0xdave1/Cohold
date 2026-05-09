/** @type {import('next').NextConfig} */
const withPWA = require('@ducanh2912/next-pwa').default;

const { assertProductionPublicApiUrl } = require('./lib/env/public-api-env.js');
if (process.env.NODE_ENV === 'production') {
  assertProductionPublicApiUrl(process.env.NEXT_PUBLIC_API_URL);
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Service worker must never cache the backend API (financial data).
 * NEXT_PUBLIC_API_URL is baked in at build time so the SW can match that origin.
 */
function buildApiOriginPattern() {
  const raw = process.env.NEXT_PUBLIC_API_URL;
  if (!raw) return null;
  try {
    const origin = new URL(raw).origin;
    return new RegExp(`^${escapeRegExp(origin)}/.*`, 'i');
  } catch {
    return null;
  }
}

const apiOriginPattern = buildApiOriginPattern();

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=()',
  },
  {
    key: 'Content-Security-Policy',
    value: "frame-ancestors 'self'; base-uri 'self'; form-action 'self'",
  },
];

if (process.env.NODE_ENV === 'production') {
  securityHeaders.push({
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  });
}

const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
  images: {
    domains: ['localhost'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.r2.cloudflarestorage.com',
      },
      {
        protocol: 'https',
        hostname: '**.s3.amazonaws.com',
      },
    ],
  },
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },
};

/**
 * PWA (Workbox) — conservative caching for a fintech product:
 * - Precache: static public assets + build output (handled by plugin defaults except start URL).
 * - Runtime: same-origin /_next/static (SWR), /icons (CacheFirst), Google Fonts (CacheFirst).
 * - NetworkOnly: all /api/* routes, Next image optimizer, and external API origin (axios uses XHR;
 *   this still protects fetch-based calls and keeps SW policy explicit).
 * - No cacheStartUrl / no dynamic start URL cache: avoid serving stale HTML for auth-sensitive shell.
 * - Document fallback: /offline — non-financial messaging only.
 */
module.exports = withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  scope: '/',
  sw: 'sw.js',
  cacheStartUrl: false,
  dynamicStartUrl: false,
  cacheOnFrontEndNav: false,
  aggressiveFrontEndNavCaching: false,
  reloadOnOnline: true,
  
  publicExcludes: ['!noprecache/**/*'],
  workboxOptions: {
   
    navigateFallbackDenylist: [/^\/api\/.*/, /^\/_next\/image/],
    disableDevLogs: true,
    runtimeCaching: [
      {
        urlPattern: ({ request, url }) =>
          request.method === 'GET' && url.pathname.startsWith('/api/'),
        handler: 'NetworkOnly',
      },
      ...(apiOriginPattern
        ? [
            {
              urlPattern: apiOriginPattern,
              handler: 'NetworkOnly',
            },
          ]
        : []),
      {
        urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'google-fonts',
          expiration: {
            maxEntries: 8,
            maxAgeSeconds: 60 * 60 * 24 * 365,
          },
        },
      },
      {
        urlPattern: /\/_next\/static\/.*/i,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'next-static',
          expiration: {
            maxEntries: 64,
            maxAgeSeconds: 60 * 60 * 24 * 30,
          },
        },
      },
      {
        urlPattern: /\/_next\/image/i,
        handler: 'NetworkOnly',
      },
      {
        urlPattern: /\/icons\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'cohold-icons',
          expiration: { maxEntries: 16, maxAgeSeconds: 60 * 60 * 24 * 365 },
        },
      },
    ],
  },
})(nextConfig);
