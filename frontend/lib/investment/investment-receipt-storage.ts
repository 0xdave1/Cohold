/**
 * Persists successful investment response payload for success UI.
 * One receipt per property id to avoid stale query-string driven confirmations.
 */
export interface StoredInvestmentReceipt {
  propertyId: string;
  investmentId: string;
  amount: string;
  shares: string;
  status: string;
  reference: string;
  createdAt: string;
  currency: string;
  savedAt: number;
}

const PREFIX = 'cohold.investReceipt.v1:';

export function saveInvestmentReceipt(receipt: Omit<StoredInvestmentReceipt, 'savedAt'>): void {
  const payload: StoredInvestmentReceipt = { ...receipt, savedAt: Date.now() };
  try {
    sessionStorage.setItem(PREFIX + receipt.propertyId, JSON.stringify(payload));
  } catch {
    // ignore storage failures to avoid blocking a confirmed success flow
  }
}

export function readInvestmentReceipt(propertyId: string): StoredInvestmentReceipt | null {
  try {
    const raw = sessionStorage.getItem(PREFIX + propertyId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredInvestmentReceipt;
    if (!parsed || parsed.propertyId !== propertyId) return null;
    return parsed;
  } catch {
    return null;
  }
}
