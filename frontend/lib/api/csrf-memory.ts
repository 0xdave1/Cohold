/**
 * CSRF value mirrored from auth JSON responses (login / refresh / complete-signup).
 * Cross-origin browsers do not expose API-host cookies to document.cookie, so the
 * header must be supplied from this in-memory value while the HttpOnly session
 * cookies still ride the wire automatically with credentials: 'include'.
 */
let clientCsrfToken: string | null = null;

export function setClientCsrfToken(token: string | null): void {
  clientCsrfToken = token;
}

export function clearClientCsrfToken(): void {
  clientCsrfToken = null;
}

export function getClientCsrfForRequest(): string | null {
  return clientCsrfToken;
}
