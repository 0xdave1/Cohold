/**
 * Must stay aligned with backend `InvestmentService` INVESTMENT_FEE_RATE (buy fee on top).
 * Used for UI previews only — settlement amounts come from the API response.
 */
export const INVESTMENT_FEE_RATE = 0.02;

/** Profit-only sell fee — aligned with `InvestmentService` SELL_PROFIT_FEE_RATE. */
export const SELL_PROFIT_FEE_RATE = 0.1;
