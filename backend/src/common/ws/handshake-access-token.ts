import type { Socket } from 'socket.io';

/**
 * Resolve JWT access token for WS auth from explicit handshake only (in-memory access token).
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
  return undefined;
}
