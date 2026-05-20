/**
 * Wallet funding API paths (generic; backend uses Paystack).
 * Flow: initialize → hosted checkout → server verify / webhook.
 */
export const WALLET_FUNDING_INITIALIZE_PATH = '/payments/initialize' as const;

export const walletFundingVerifyPath = (reference: string) =>
  `/payments/verify/${encodeURIComponent(reference)}` as const;
