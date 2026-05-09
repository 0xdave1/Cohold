import { redactForDebug } from '@/lib/logging/redact-for-debug';

/**
 * Logs only outside production; redacts tokens/PII-like substrings from payloads.
 */
export function safeDebugLog(_scope: string, payload?: unknown): void {
  if (process.env.NODE_ENV === 'production') return;
  if (typeof console === 'undefined' || !console.debug) return;
  try {
    const safe = payload === undefined ? '' : redactForDebug(payload);
    // eslint-disable-next-line no-console -- dev-only diagnostic behind NODE_ENV guard
    console.debug(`[Cohold] ${_scope}`, safe);
  } catch {
    // eslint-disable-next-line no-console
    console.debug(`[Cohold] ${_scope}`);
  }
}
