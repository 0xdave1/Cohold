/** Prisma `TransactionType` values returned by `/wallets/transactions`. */
export const WALLET_TRANSACTION_TYPE_LABELS: Record<string, string> = {
  WALLET_TOP_UP: 'Wallet top-up',
  WALLET_WITHDRAWAL: 'Withdrawal',
  WALLET_SWAP: 'Swap',
  P2P_TRANSFER: 'P2P transfer',
  INVESTMENT: 'Investment',
  BUY: 'Property buy',
  SELL: 'Property sell',
  ROI: 'ROI',
  PROPERTY_FUNDING: 'Property funding',
  DISTRIBUTION: 'Distribution',
  FEE: 'Fee',
};

export function walletTransactionTypeLabel(type: string): string {
  return WALLET_TRANSACTION_TYPE_LABELS[type] ?? type;
}
