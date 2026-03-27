/**
 * Persists the exact sell API payload for the success screen (avoids URL encoding / truncation).
 * One receipt per property id; consumed on read so refresh does not show stale numbers.
 */

export interface StoredSellReceipt {
  propertyId: string;
  shares: string;
  /** Backend `sellAmount` (gross) */
  sellAmount: string;
  /** Backend `fee` (platform fee on profit) */
  platformFee: string;
  netToUser: string;
  costBasis: string;
  walletBalanceAfter?: string;
  currency: string;
  savedAt: number;
}

const PREFIX = 'cohold.sellReceipt.v1:';
const MAX_AGE_MS = 15 * 60 * 1000;

export function saveSellReceipt(receipt: Omit<StoredSellReceipt, 'savedAt'>): void {
  if (typeof window === 'undefined') return;
  const payload: StoredSellReceipt = { ...receipt, savedAt: Date.now() };
  try {
    sessionStorage.setItem(PREFIX + receipt.propertyId, JSON.stringify(payload));
  } catch {
    // quota / private mode — success page will fall back to query params
  }
}

function parseReceipt(propertyId: string, raw: string): StoredSellReceipt | null {
  try {
    const parsed = JSON.parse(raw) as StoredSellReceipt;
    if (parsed.propertyId !== propertyId) return null;
    if (Date.now() - (parsed.savedAt ?? 0) > MAX_AGE_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Read the latest receipt for this property (does not remove — next sell overwrites).
 * Avoids removing on read so React Strict Mode / remounts still see the same payload.
 */
export function readSellReceipt(propertyId: string): StoredSellReceipt | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(PREFIX + propertyId);
  if (!raw) return null;
  return parseReceipt(propertyId, raw);
}

export function clearSellReceipt(propertyId: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(PREFIX + propertyId);
  } catch {
    /* ignore */
  }
}
