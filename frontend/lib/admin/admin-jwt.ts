/**
 * Decode admin access JWT payload (UI hints only — backend enforces auth).
 * Does not verify signature.
 */
export type AdminAccessJwtPayload = {
  sub: string;
  email?: string;
  role?: string;
  sessionId?: string;
  tokenType?: string;
};

function base64UrlDecode(segment: string): string {
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  const withPad = padded + '='.repeat(padLen);
  if (typeof Buffer !== 'undefined') {
    try {
      return Buffer.from(withPad, 'base64').toString('utf8');
    } catch {
      return '';
    }
  }
  if (typeof atob !== 'undefined') {
    try {
      return decodeURIComponent(
        Array.prototype.map
          .call(atob(withPad), (c: string) => `%${(`00${c.charCodeAt(0).toString(16)}`).slice(-2)}`)
          .join(''),
      );
    } catch {
      return '';
    }
  }
  return '';
}

export function decodeAdminAccessToken(token: string | null | undefined): AdminAccessJwtPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const json = base64UrlDecode(parts[1]!);
    if (!json) return null;
    const payload = JSON.parse(json) as AdminAccessJwtPayload;
    if (payload.tokenType && payload.tokenType !== 'admin_access') return null;
    return payload;
  } catch {
    return null;
  }
}
