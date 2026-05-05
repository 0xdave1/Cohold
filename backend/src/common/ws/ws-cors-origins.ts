/**
 * Explicit browser origins for Socket.IO (credentials: true). Never use '*'.
 * Keep in sync across user / admin / support gateways.
 */
export const COHOLD_WS_CORS_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://cohold.co',
  'https://www.cohold.co',
  'https://cohold.vercel.app',
  'https://cohold.onrender.com',
] as const;

export function wsCorsOptions(): { origin: readonly string[]; credentials: true } {
  return { origin: COHOLD_WS_CORS_ORIGINS, credentials: true };
}
