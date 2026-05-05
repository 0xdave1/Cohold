/**
 * Headers forwarded from the Next admin BFF proxy to the API (Issue 4 / CSRF tests).
 */
export function buildAdminProxyUpstreamHeaders(input: {
  cookieHeader: string;
  method: string;
  csrfCookieValue: string | undefined;
  contentType: string | null;
}): Record<string, string> {
  const headers: Record<string, string> = { Cookie: input.cookieHeader };
  if (input.contentType) {
    headers['Content-Type'] = input.contentType;
  }
  const m = input.method.toUpperCase();
  if (m !== 'GET' && m !== 'HEAD' && m !== 'OPTIONS' && input.csrfCookieValue) {
    headers['X-CSRF-Token'] = input.csrfCookieValue;
  }
  return headers;
}
