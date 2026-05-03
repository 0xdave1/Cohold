/**
 * Issue 1 — Wallet funding (frontend contract)
 *
 * User wallets must not be credited from any client-triggered “credit wallet” HTTP route.
 * Production funding from this app is only: Flutterwave checkout init → server verify / webhook.
 * Never add client-side balance simulation or unverified ledger credits.
 */
export const FLUTTERWAVE_WALLET_FUNDING_INITIALIZE_PATH =
  '/payments/flutterwave/initialize' as const;

/** GET verify — must match `PaymentsController` `@Get('verify/:reference')` under API prefix. */
export const flutterwaveWalletFundingVerifyPath = (reference: string) =>
  `/payments/verify/${encodeURIComponent(reference)}` as const;
