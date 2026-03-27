import Decimal from 'decimal.js';

const EPS = new Decimal('0.0001');

/** Matches `estimateSellFifoPreview` result (non-null). */
export type SellFifoPreview = {
  sellAmount: string;
  costBasis: string;
  profit: string;
  platformFee: string;
  netToUser: string;
};

export interface BackendSellPayload {
  sellAmount: string;
  fee: string;
  netToUser: string;
  costBasis: string;
}

/**
 * Compare FIFO preview to settled backend amounts; warn if they diverge (rounding / price drift).
 */
export function logSellPreviewVsBackendMismatch(
  preview: SellFifoPreview | null,
  backend: BackendSellPayload,
  propertyId: string,
): void {
  if (!preview) return;

  const pairs: Array<[string, string, string]> = [
    ['sellAmount', preview.sellAmount, backend.sellAmount],
    ['costBasis', preview.costBasis, backend.costBasis],
    ['platformFee', preview.platformFee, backend.fee],
    ['netToUser', preview.netToUser, backend.netToUser],
  ];

  const mismatches: string[] = [];
  for (const [name, a, b] of pairs) {
    try {
      if (new Decimal(a).minus(b).abs().gt(EPS)) {
        mismatches.push(`${name}: preview=${a} backend=${b}`);
      }
    } catch {
      mismatches.push(`${name}: parse error preview=${a} backend=${b}`);
    }
  }

  if (mismatches.length > 0) {
    console.warn('[Cohold] Sell preview vs backend mismatch', { propertyId, mismatches });
  }
}
