# Cohold Backend (NestJS, PostgreSQL, Redis, BullMQ)

Enterprise-grade backend for the Cohold fractional real estate investment platform.

## Stack

- NestJS (TypeScript, strict mode)
- PostgreSQL via Prisma
- Redis (caching + BullMQ queue backend)
- BullMQ (emails, payments, audits, distributions)
- Elasticsearch (search for properties, users, transactions)
- WebSockets (user + admin namespaces)
- Paystack (NGN payments/webhooks)
- S3-compatible storage (Cloudflare R2 / AWS S3)

## High-level architecture

- `Controllers` – HTTP/WebSocket boundary only (no business logic).
- `Services` – business logic and orchestration (wallets, investments, KYC, admin).
- `Repositories` – Prisma-based data access consolidated via `PrismaService`.
- `Integrations` – Paystack, Redis, BullMQ, Elasticsearch, S3/R2.

### Key modules

- `AuthModule` – user authentication (`/auth/*`).
- `AdminAuthModule` – admin/staff authentication (`/admin-auth/*`).
- `UsersModule` – user profile (`/users/me`).
- `WalletModule` – balances, swaps, P2P-ready money operations (`/wallets/*`).
- `PaymentModule` – Paystack webhook handling + wallet crediting.
- `InvestmentModule` – fractional investments, property share allocation.
- `PropertyModule` – property lifecycle (DRAFT → ... → PUBLISHED).
- `KycModule` – BVN submission + admin review flows.
- `TransferModule` – P2P transfers between users.
- `AdminModule` – admin dashboard, distributions, compliance, activity log.
- `WebhookModule` – Paystack webhook endpoint.
- `QueueModule` – BullMQ queues (email, reconciliation, documents, audits).
- `CacheModule` – Redis-backed caching.
- `SearchModule` – Elasticsearch indexing/search.
- `GatewayModule` – WebSocket gateways for users and admins.

### User vs Admin separation

- Separate JWT secrets and audiences:
  - Users: `JWT_USER_SECRET`, audience `cohold-user`.
  - Admins: `JWT_ADMIN_SECRET`, audience `cohold-admin`.
- Admin controllers use `AdminJwtGuard` + `RolesGuard` and `@Roles(...)`.
- User endpoints use `JwtAuthGuard`.
- Admin routes are all under `/api/v1/admin/*` or `/api/v1/admin-auth/*`.

## Money handling

- All money values are stored as `NUMERIC(19,4)` or `NUMERIC(24,8)` in Postgres.
- All calculations use `Decimal.js` with **banker's rounding** configured globally.
- API DTOs accept amounts as strings; services convert with `toDecimal()`.
- API responses return monetary fields as strings to avoid precision loss.

**Critical flows to review manually:**

- Wallet top-ups and swaps (`WalletService`).
- Paystack webhook processing (`PaymentService`, `WebhookController`).
- P2P transfers (`TransferService`).
- Fractional investments and share allocation (`InvestmentService`).
- Pro-rata distributions (`AdminService#createDistributionBatch`).

Ensure concurrency tests are run around property funding and wallet operations.

## Running locally (no Docker)

**Prerequisites:** PostgreSQL installed on Windows. Create the database:

```bash
psql -U postgres -c "CREATE DATABASE cohold;"
```

In `backend/`:

1. Copy `.env.example` to `.env` and set `DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/cohold` (replace `YOUR_PASSWORD` with your postgres user password).
2. Install, migrate, and run:

```bash
npm install
npx prisma migrate dev
npm run start:dev
```

The API is served at **http://localhost:4000** (or the port in `.env`), with Swagger at **http://localhost:4000/docs**. Redis and Docker are not required for local development.

## Running with Docker

From repo root, start Postgres and Redis:

```bash
docker compose up -d postgres redis
```

Then in `backend/` set `DATABASE_URL` to use host `postgres` and run `npx prisma migrate dev` and `npm run start:dev`. Or run the full stack:

```bash
docker compose up --build
```

## Environment

See repo root `docker-compose.yml` for required variables. Use a `.env` in `backend/` for local runs, e.g.:

- App: `NODE_ENV`, `PORT`, `API_PREFIX`
- Database: `DATABASE_URL`
- Redis: `REDIS_URL`
- JWT (user/admin): secrets + TTLs
- Paystack: `PAYSTACK_SECRET_KEY`, `PAYSTACK_WEBHOOK_SECRET`
- S3/R2: access/secret keys, bucket, region, endpoint
- Email: `EMAIL_API_KEY`, `EMAIL_FROM`

The app will fail fast on startup if required env vars are missing.
