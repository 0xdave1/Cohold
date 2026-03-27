import Decimal from 'decimal.js';
import { SELL_PROFIT_FEE_RATE } from '@/lib/constants/investment';

const MONEY_DP = 4;
const SHARE_DP = 8;

function fixMoney(d: Decimal): Decimal {
  return d.toDecimalPlaces(MONEY_DP, Decimal.ROUND_DOWN);
}

function fixShare(d: Decimal): Decimal {
  return d.toDecimalPlaces(SHARE_DP, Decimal.ROUND_DOWN);
}

export type SellPositionInput = {
  id: string;
  shares: string;
  amount: string;
  sharePrice: string;
  createdAt: string;
};

/**
 * FIFO cost basis + profit-only fee — mirrors backend `sellFractional` math (preview only).
 */
export function estimateSellFifoPreview(
  listingSharePrice: string,
  sharesToSellStr: string,
  positions: SellPositionInput[],
): {
  sellAmount: string;
  costBasis: string;
  profit: string;
  platformFee: string;
  netToUser: string;
} | null {
  const sp = fixShare(new Decimal(listingSharePrice || '0'));
  const sharesToSell = new Decimal(sharesToSellStr || '0');
  if (sp.lte(0) || sharesToSell.lte(0)) return null;

  const ordered = [...positions].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  let remaining = sharesToSell;
  let costBasis = new Decimal(0);

  for (const pos of ordered) {
    if (remaining.lte(0)) break;
    const posShares = new Decimal(pos.shares || '0');
    const posAmount = new Decimal(pos.amount || '0');
    if (posShares.lte(0)) continue;

    const posPx = fixShare(new Decimal(pos.sharePrice || '0'));
    if (!posPx.eq(sp)) {
      return null;
    }

    const take = Decimal.min(posShares, remaining);
    const sliceCost = fixMoney(take.mul(posAmount.div(posShares)));
    costBasis = costBasis.plus(sliceCost);
    remaining = remaining.minus(take);
  }

  if (remaining.gt(0)) return null;

  const sellAmount = fixMoney(sp.mul(sharesToSell));
  costBasis = fixMoney(costBasis);
  const profit = fixMoney(sellAmount.minus(costBasis));
  const platformFee = profit.gt(0) ? fixMoney(profit.mul(SELL_PROFIT_FEE_RATE)) : new Decimal(0);
  const netToUser = fixMoney(sellAmount.minus(platformFee));

  return {
    sellAmount: sellAmount.toFixed(MONEY_DP),
    costBasis: costBasis.toFixed(MONEY_DP),
    profit: profit.toFixed(MONEY_DP),
    platformFee: platformFee.toFixed(MONEY_DP),
    netToUser: netToUser.toFixed(MONEY_DP),
  };
}
