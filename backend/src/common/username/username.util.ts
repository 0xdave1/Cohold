import { BadRequestException } from '@nestjs/common';

export const USERNAME_MIN_LEN = 3;
export const USERNAME_MAX_LEN = 20;

// Keep list small + high-signal; expand anytime without DB changes.
const RESERVED_USERNAMES = new Set(
  [
    'admin',
    'support',
    'cohold',
    'api',
    'wallet',
    'payments',
    'official',
    'team',
    'security',
    'root',
    'me',
    'system',
  ].map((s) => s.toLowerCase()),
);

export type UsernameValidationResult =
  | { ok: true; normalized: string }
  | { ok: false; code: 'USERNAME_REQUIRED' | 'USERNAME_INVALID' | 'USERNAME_RESERVED'; message: string };

/**
 * Normalize a username input for validation/persistence.
 * - trims whitespace
 * - removes leading '@' if supplied
 * - lowercases
 */
export function normalizeUsername(input: string | null | undefined): string {
  const raw = (input ?? '').trim();
  const withoutAt = raw.startsWith('@') ? raw.slice(1) : raw;
  return withoutAt.trim().toLowerCase();
}

export function validateUsername(input: string | null | undefined): UsernameValidationResult {
  const normalized = normalizeUsername(input);

  if (!normalized) {
    return { ok: false, code: 'USERNAME_REQUIRED', message: 'Username is required' };
  }

  if (normalized.length < USERNAME_MIN_LEN || normalized.length > USERNAME_MAX_LEN) {
    return {
      ok: false,
      code: 'USERNAME_INVALID',
      message: `Username must be ${USERNAME_MIN_LEN}-${USERNAME_MAX_LEN} characters`,
    };
  }

  // letters, numbers, underscore only
  if (!/^[a-z0-9_]+$/.test(normalized)) {
    return {
      ok: false,
      code: 'USERNAME_INVALID',
      message: 'Username may only contain letters, numbers, and underscore',
    };
  }

  if (RESERVED_USERNAMES.has(normalized)) {
    return {
      ok: false,
      code: 'USERNAME_RESERVED',
      message: 'This username is reserved',
    };
  }

  return { ok: true, normalized };
}

export function assertValidUsername(input: string | null | undefined): string {
  const v = validateUsername(input);
  if (!v.ok) {
    throw new BadRequestException({ code: v.code, message: v.message });
  }
  return v.normalized;
}

