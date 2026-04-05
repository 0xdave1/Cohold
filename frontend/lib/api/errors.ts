import axios from 'axios';

type ApiErrorBody = {
  code?: string;
  message?: string | string[];
};

function readErrorPayload(data: unknown): ApiErrorBody | null {
  if (!data || typeof data !== 'object') return null;
  const root = data as Record<string, unknown>;
  const err = root.error;
  if (err && typeof err === 'object' && err !== null) {
    return err as ApiErrorBody;
  }
  return root as ApiErrorBody;
}

/**
 * Structured error code from the API (e.g. OTP_NOT_VERIFIED).
 */
export function getApiErrorCode(error: unknown): string | undefined {
  if (!axios.isAxiosError(error)) return undefined;
  const payload = readErrorPayload(error.response?.data);
  const code = payload?.code;
  return typeof code === 'string' ? code : undefined;
}

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
  const err = readErrorPayload(data) ?? data;
  const raw =
    typeof err === 'object' && err !== null && 'message' in err
      ? (err as ApiErrorBody).message
      : (data as { message?: string }).message;
  if (Array.isArray(raw)) return raw[0] ?? fallback;
  if (typeof raw === 'string') return raw;
  return fallback;
}
