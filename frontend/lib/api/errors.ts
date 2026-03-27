import axios from 'axios';

/**
 * Extract a user-friendly error message from an API error (axios or backend shape).
 * Handles backend format: { success: false, error: { message: string | string[] } }
 */
export function getApiErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error.message : fallback;
  }
  const data = error.response?.data;
  if (!data) return fallback;
  const err = data.error ?? data;
  const raw = typeof err === 'object' && err !== null && 'message' in err ? err.message : (data as { message?: string }).message;
  if (Array.isArray(raw)) return raw[0] ?? fallback;
  if (typeof raw === 'string') return raw;
  return fallback;
}
