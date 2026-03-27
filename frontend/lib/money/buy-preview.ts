import Decimal from 'decimal.js';
import { INVESTMENT_FEE_RATE } from '@/lib/constants/investment';

export function buyPreviewFromShares(sharePrice: string, shares: string) {
  const sp = new Decimal(sharePrice || '0');
  const sh = new Decimal(shares || '0');
  const principal = sp.mul(sh).toDecimalPlaces(8, Decimal.ROUND_DOWN);
  const fee = principal.mul(INVESTMENT_FEE_RATE).toDecimalPlaces(4, Decimal.ROUND_DOWN);
  const totalCharge = principal.plus(fee).toDecimalPlaces(4, Decimal.ROUND_DOWN);
  return {
    shares: sh.toFixed(0),
    principal: principal.toFixed(4),
    fee: fee.toFixed(4),
    totalCharge: totalCharge.toFixed(4),
  };
}

export function buyPreviewFromAmount(sharePrice: string, amount: string) {
  const sp = new Decimal(sharePrice || '0');
  if (sp.lte(0)) {
    return { shares: '0', principal: '0.0000', fee: '0.0000', totalCharge: '0.0000' };
  }
  const target = new Decimal(amount || '0');
  const sharesInt = target.div(sp).toDecimalPlaces(0, Decimal.ROUND_DOWN);
  const sh = sharesInt.toFixed(0);
  const base = buyPreviewFromShares(sharePrice, sh);
  return { ...base, shares: sh };
}
