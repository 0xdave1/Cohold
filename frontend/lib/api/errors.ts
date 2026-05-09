import axios from 'axios';
import { mapApiError, sanitizeBackendMessage } from '@/lib/api/security-errors';

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

export { mapApiError, sanitizeBackendMessage, classifySecurityError } from '@/lib/api/security-errors';
export type { MappedApiError, SecurityErrorKind } from '@/lib/api/security-errors';

/**
 * Extract a user-friendly error message from an API error (axios or backend shape).
 * Handles backend format: { success: false, error: { message: string | string[] } }
 * Applies sanitization for Prisma/stack/PII-like patterns (Issue 9).
 */
export function getApiErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (axios.isAxiosError(error)) {
    return mapApiError(error, fallback).message;
  }
  if (error instanceof Error) {
    return sanitizeBackendMessage(error.message) || fallback;
  }
  return fallback;
}
