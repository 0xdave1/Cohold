/**
 * Double-submit CSRF for cookie-backed mutating requests (backend `CsrfGuard`).
 * Safe methods must not receive a CSRF header from this helper.
 */
export function attachCsrfHeaderForUnsafeMethod(
  method: string | undefined,
  headers: Record<string, string>,
  readCsrf: () => string | undefined,
): void {
  const m = String(method ?? 'get').toUpperCase();
  if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return;
  const csrf = readCsrf();
  if (csrf) {
    headers['X-CSRF-Token'] = csrf;
  }
}
