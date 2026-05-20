import type { VirtualAccount } from '@/lib/hooks/use-wallet';

export type DedicatedAccountPillKind =
  | 'loading'
  | 'kyc_required'
  | 'active'
  | 'provisioning'
  | 'retry'
  | 'unavailable';

export type DedicatedAccountPillState = {
  kind: DedicatedAccountPillKind;
  /** Masked label for active pill only, e.g. "•••• 1299" — never full account number. */
  maskedLabel?: string;
  clickable: boolean;
};

/**
 * Formats a masked dedicated-account label for dashboard display.
 * Never returns the full account number.
 */
export function formatDedicatedAccountMask(opts: {
  accountNumberLast4?: string | null;
  accountNumber?: string | null;
}): string | null {
  const fromLast4 = opts.accountNumberLast4;
  if (fromLast4) {
    const digits = String(fromLast4).replace(/\D/g, '');
    const last4 = digits.slice(-4);
    if (last4.length === 4) return `•••• ${last4}`;
  }
  const raw = opts.accountNumber;
  if (raw) {
    const digits = String(raw).replace(/\D/g, '');
    const last4 = digits.slice(-4);
    if (last4.length === 4) return `•••• ${last4}`;
  }
  return null;
}

const PROVISIONING_STATUSES = new Set(['PENDING', 'PROCESSING']);
const RETRY_STATUSES = new Set(['FAILED', 'REQUIRES_RETRY']);
const UNAVAILABLE_STATUSES = new Set(['UNAVAILABLE', 'UNKNOWN', 'NONE', 'SUSPENDED', 'CLOSED']);

export function resolveDedicatedAccountPillState(params: {
  kycVerified: boolean;
  isLoading?: boolean;
  status?: VirtualAccount['status'] | string | null;
  accountNumberLast4?: string | null;
  accountNumber?: string | null;
}): DedicatedAccountPillState {
  if (params.isLoading) {
    return { kind: 'loading', clickable: false };
  }

  if (!params.kycVerified) {
    return { kind: 'kyc_required', clickable: true };
  }

  const status = String(params.status ?? 'UNKNOWN').toUpperCase();

  if (status === 'ACTIVE') {
    const maskedLabel = formatDedicatedAccountMask({
      accountNumberLast4: params.accountNumberLast4,
      accountNumber: params.accountNumber,
    });
    if (maskedLabel) {
      return { kind: 'active', maskedLabel, clickable: true };
    }
    return { kind: 'unavailable', clickable: false };
  }

  if (PROVISIONING_STATUSES.has(status)) {
    return { kind: 'provisioning', clickable: false };
  }

  if (RETRY_STATUSES.has(status)) {
    return { kind: 'retry', clickable: true };
  }

  if (UNAVAILABLE_STATUSES.has(status)) {
    return { kind: 'unavailable', clickable: false };
  }

  return { kind: 'unavailable', clickable: false };
}
