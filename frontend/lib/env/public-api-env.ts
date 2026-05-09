/**
 * Build-time / server validation for public API URL (no secrets here).
 * Call from next.config.js during production builds.
 */
export function assertProductionPublicApiUrl(apiUrl: string | undefined): void {
  const allowInsecure = process.env.ALLOW_INSECURE_PUBLIC_API_URL === 'true';
  const trimmed = (apiUrl ?? '').trim();
  if (!trimmed) {
    throw new Error(
      'NEXT_PUBLIC_API_URL is required for production builds so the browser targets the correct API origin.',
    );
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error('NEXT_PUBLIC_API_URL must be a valid absolute URL (e.g. https://api.cohold.co/api/v1).');
  }
  const host = url.hostname.toLowerCase();
  if (!allowInsecure && (host === 'localhost' || host === '127.0.0.1' || host === '[::1]')) {
    throw new Error(
      'NEXT_PUBLIC_API_URL cannot point to localhost in production. Use your deployed API origin.',
    );
  }
  if (url.protocol !== 'https:' && !allowInsecure) {
    throw new Error(
      'NEXT_PUBLIC_API_URL must use https in production. Set ALLOW_INSECURE_PUBLIC_API_URL=true only for explicit staging exceptions.',
    );
  }
}
