import { randomUUID } from 'crypto';

/**
 * Human-friendly support reference code.
 * Format: SUP-XXXXXX
 */
export function generateSupportReferenceCode(): string {
  const raw = randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
  return `SUP-${raw}`;
}

