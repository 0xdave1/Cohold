# Dual wallet funding (card + virtual account)

## Environment

- `PAYSTACK_SECRET_KEY` – Paystack secret key (test or live).
- `PAYSTACK_WEBHOOK_SECRET` – signing secret from Paystack dashboard.
- `FRONTEND_URL` – public URL of the Next.js app (e.g. `http://localhost:3001`). Used for Paystack **callback** after card payment. Should match `NEXT_PUBLIC_APP_URL` on the frontend.

## Card funding flow

1. `POST /api/v1/payments/initialize` (JWT) – body `{ "amount": "5000", "currency": "NGN" }` → returns `authorizationUrl` and `reference`.
2. User completes payment on Paystack.
3. Configure Paystack webhook to one of:
   - `POST /api/v1/webhook/paystack`
   - `POST /api/v1/webhooks/paystack` (alias)
4. On `charge.success`, the backend credits the wallet **once per Paystack reference** (idempotent).

## Virtual account (bank transfer)

After KYC approval, a Paystack customer code may be stored on the user (`paystackCustomerCode`) and a dedicated account is created. Inbound transfers trigger `charge.success` and credit by virtual account number or customer email.

## Dev-only test credit

`POST /api/v1/wallets/dev-credit` with `{ "amount": "1000", "currency": "NGN" }` – only when `NODE_ENV !== 'production'`.
