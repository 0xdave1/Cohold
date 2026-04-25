import type { Socket } from 'socket.io';

/**
 * Resolve JWT access token for WS auth: prefer explicit handshake auth (legacy),
 * then read HttpOnly cookie set by the HTTP API (cookie-only clients).
 */
export function getAccessTokenFromHandshake(client: Socket): string | undefined {
  const fromAuth = client.handshake.auth?.token;
  if (typeof fromAuth === 'string' && fromAuth.length > 0) {
    return fromAuth;
  }
  const queryToken = client.handshake.query?.token;
  if (typeof queryToken === 'string' && queryToken.length > 0) {
    return queryToken;
  }
  const raw = client.handshake.headers?.cookie;
  if (typeof raw !== 'string' || !raw.length) {
    return undefined;
  }
  const match = raw.match(/(?:^|;\s*)cohold_access_token=([^;]+)/);
  return match ? decodeURIComponent(match[1].trim()) : undefined;
}
