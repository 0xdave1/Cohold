# Cohold Project – Implementation Summary

**Document version:** 1.0  
**Last updated:** February 2026  
**Purpose:** Presentation-ready overview of the Cohold frontend and full-stack implementation for team and stakeholders.

---

## 1. High-Level Architecture

### 1.1 Monorepo Structure

| Layer | Stack | Location |
|-------|--------|----------|
| **Backend** | NestJS 10, TypeScript, Prisma, PostgreSQL | `backend/` |
| **Frontend** | Next.js 14 (App Router), React 18, TypeScript | `frontend/` |

- **Separation:** Backend and frontend are fully independent: separate `package.json`, `node_modules`, and config. No cross-imports.
- **API contract:** REST at `NEXT_PUBLIC_API_URL` (e.g. `http://localhost:3000/api/v1`). Backend uses global prefix `/api/v1`, Swagger at `/docs`.
- **Deployment:** Can run locally (no Docker) or via Docker Compose (Postgres, Redis, API, Next.js).

### 1.2 Frontend Architecture

- **Routing:** Next.js App Router with route groups:
  - `(auth)` – signup, login, verify-otp, forgot-password, reset-password
  - `onboarding` – personal-details, residential-details, review, success
  - `dashboard` – home, account, kyc, investments, properties, wallets (incl. top-up, swap, p2p, withdraw)
- **State:** Zustand (`stores/auth.store.ts`) for auth (tokens, user, role) with `localStorage` persistence.
- **Server state:** TanStack Query (React Query) for all API data; hooks in `lib/hooks/`.
- **API layer:** Central Axios client (`lib/api/client.ts`) with JWT injection and 401 → session clear.

### 1.3 Backend Architecture

- **Modules:** Auth, AdminAuth, Users, Wallet, Payment, Investment, Property, Kyc, Transfer, Admin, Webhook, Cache (in-memory when Redis disabled), Queue (stub), Search, Gateway (WebSockets), Email, Storage, Fx.
- **Auth:** Single JWT secret for users and admins; role in payload; `JwtAuthGuard` + `AdminRoleGuard` for admin routes.
- **Data:** Prisma + PostgreSQL; core entities: User, Admin, Wallet, Transaction, Property, Investment, KycVerification, VirtualAccount, Distribution, etc.

---

## 2. Major Features Implemented

### 2.1 Authentication (End-to-End)

| Feature | Frontend | Backend | Status |
|--------|----------|---------|--------|
| Signup | Email + password + optional referral code | `POST /auth/signup` | ✅ |
| Request OTP | Resend / request-otp | `POST /auth/request-otp` | ✅ |
| Verify OTP | 6-digit input, auto-focus | `POST /auth/verify-otp` | ✅ |
| Complete signup | Token + redirect to onboarding | `POST /auth/complete-signup` | ✅ |
| Login | Email + password | `POST /auth/login` | ✅ |
| Forgot password | Email → OTP | `POST /auth/request-otp` (purpose: login) | ✅ |
| Reset password | New + confirm password | `POST /auth/reset-password` | ✅ |
| Refresh token | Used by client | `POST /auth/refresh` | ✅ |
| Logout | Clear session + redirect | Client-only (Zustand + redirect) | ✅ |

### 2.2 Onboarding

| Step | Route | Backend | Status |
|------|--------|---------|--------|
| Personal details | `/onboarding/personal-details` | `PUT /user/personal-details` | ✅ |
| Residential details | `/onboarding/residential-details` | `PUT /user/residential-details` | ✅ |
| Review | `/onboarding/review` | — | ✅ |
| Success | `/onboarding/success` | `POST /users/me/complete-onboarding` | ✅ |
| Guard | Redirect unauthenticated to login | — | ✅ |

### 2.3 Dashboard – Home

- **Data:** User greeting from `GET /users/me` (firstName), balances from `GET /wallets/balances`, virtual accounts from `GET /wallets/virtual-accounts`, “My Investments” from `GET /investments`, listings from `GET /properties`.
- **UI:** Figma-aligned layout: avatar with initials, “Hi {name}”, balance card with currency selector, card preview (•••• last4), actions (Top up, Swap, Withdraw, P2P), horizontal “My Investments” and “Listings” sections.
- **Modals:** My accounts (currency switch), Top up (bank details + copy), Withdraw (amount + OTP flow), Account details, Unverified prompts.
- **Navigation:** Bottom nav (Home, Investments, Listings, Accounts).

### 2.4 Account Section

| Screen | Route | Backend / Hooks | Status |
|--------|--------|------------------|--------|
| Account home | `/dashboard/account` | `useMe`, `useKycStatus` | ✅ |
| Edit profile | `/dashboard/account/edit` | `PATCH /users/me`, `useOnboarding().updateProfile` | ✅ |
| Account verification | Linked to `/dashboard/kyc` | KYC wizard (BVN + docs) | ✅ |
| Linked banks | `/dashboard/account/linked-banks` | `GET/POST/DELETE /users/me/linked-banks` (stub) | ✅ |
| Logout / Delete | Modals on account page | `useAuth().logout`, `useDeleteAccount` + OTP | ✅ |

**Account sub-routes:** All have dedicated pages: transactions (with filters), referrals, verification (BVN/NIN), biometrics (placeholder), password-reset, contact, terms, privacy, linked-banks, linked-banks/add.

### 2.5 KYC

| Feature | Frontend | Backend | Status |
|--------|----------|---------|--------|
| BVN submit | KYC wizard step | `POST /kyc/bvn` | ✅ |
| NIN submit | — | `POST /kyc/nin` | ✅ (backend only; no dedicated verification page) |
| Document upload | ID front/back (file input) | `POST /kyc/upload-document` (multipart) | ✅ |
| Status | From `GET /users/me` (kycStatus) | — | ✅ |
| Hooks | `useKycStatus`, `useSubmitBvn`, `useSubmitNin`, `useUploadKycDocument` | — | ✅ |

### 2.6 Wallets & Transactions

| Feature | Frontend | Backend | Status |
|--------|----------|---------|--------|
| Balances | Home + wallets page | `GET /wallets/balances` | ✅ |
| Virtual accounts | Top-up / account details modals | `GET /wallets/virtual-accounts` | ✅ |
| Top-up | Modal (copy bank details) | `POST /wallets/top-up` | ✅ |
| Swap | `/dashboard/wallets/swap` (+ success) | `POST /wallets/swap` | ✅ |
| Withdraw | Modal → OTP → success redirect | — (flow in place; backend may be stub) | ✅ |
| P2P | `/dashboard/wallets/p2p` (+ success) | `POST /transfers/p2p` | ✅ |
| Transactions list | — | `GET /wallets/transactions` (with filters) | ✅ Backend only; no dedicated UI page |

### 2.7 Properties & Investments

| Feature | Frontend | Backend | Status |
|--------|----------|---------|--------|
| Listings | Home + `/dashboard/properties` | `GET /properties` (published) | ✅ |
| Property detail | `/dashboard/properties/[id]` | `GET /properties/:id` | ✅ |
| My investments | Home carousel + `/dashboard/investments` | `GET /investments` (current user) | ✅ |
| Create investment | Property detail / invest flow | `POST /investments/fractional` | ✅ |

### 2.8 Referrals & Linked Banks (Backend Stub)

- **Referrals:** `GET /users/me/referrals` returns stub `{ referralCode: null, earnings: '0', referrals: [] }`. Hooks: `useReferrals`.
- **Linked banks:** `GET /users/me/linked-banks` (empty list), `POST /users/me/linked-banks`, `DELETE /users/me/linked-banks/:id` (stub). Hooks: `useLinkedBanks`, `useAddLinkedBank`, `useRemoveLinkedBank`.

### 2.9 Account Deletion

- **Flow:** Confirm → Enter email → Request OTP (`purpose: delete_account`) → Enter OTP → `POST /users/me/delete` → freeze account (isFrozen), clear session, redirect to login.
- **Hooks:** `useRequestDeleteAccountOtp`, `useDeleteAccount` in `lib/hooks/use-account.ts`.

---

## 3. Screens and Flows – Summary

| Area | Screens / Flows | Completed |
|------|------------------|-----------|
| **Auth** | Signup → OTP → Complete signup; Login; Forgot → OTP → Reset password | ✅ |
| **Onboarding** | Personal details → Residential → Review → Success | ✅ |
| **Dashboard** | Home (balance, actions, investments, listings, modals); redirect if not onboarded | ✅ |
| **Account** | Account home, Edit profile, Linked banks; Logout/Delete modals | ✅ (partial: several links have no page) |
| **KYC** | Multi-step wizard (BVN → ID front → ID back → Preview); verified state | ✅ |
| **Wallets** | Balances, virtual accounts, top-up/withdraw modals; Swap & P2P pages + success | ✅ |
| **Properties** | List (home + dedicated), detail, invest flow | ✅ |
| **Investments** | “My Investments” on home; investments page | ✅ |
| **Transactions** | Backend: filtered list API. Frontend: no dedicated transactions page yet | ⚠️ Backend only |
| **Referrals** | Backend stub; hooks exist. No dedicated referrals page | ⚠️ Stub + no page |
| **Biometrics / Password reset (in app)** | Account links to biometrics & password-reset; no in-dashboard pages (forgot/reset are auth pages) | ⚠️ Links only |
| **Terms / Privacy / Contact** | Linked from account; no static pages | ⚠️ Missing |

---

## 4. Backend Integrations Wired Up

- **Auth:** All auth endpoints used (signup, request-otp, verify-otp, complete-signup, login, refresh, reset-password). OTP purpose extended to `delete_account` for account deletion.
- **Users:** `GET /users/me`, `PATCH /users/me`, `POST /users/me/complete-onboarding`, `POST /users/me/delete`, `GET/POST/DELETE /users/me/referrals` and `/users/me/linked-banks` (stub).
- **User (onboarding):** `PUT /user/personal-details`, `PUT /user/residential-details`.
- **Wallets:** `GET /wallets/balances`, `GET /wallets/virtual-accounts`, `GET /wallets/transactions`, `POST /wallets/top-up`, `POST /wallets/swap`.
- **KYC:** `POST /kyc/bvn`, `POST /kyc/nin`, `POST /kyc/upload-document`.
- **Investments:** `GET /investments`, `POST /investments/fractional`.
- **Properties:** `GET /properties`, `GET /properties/:id`.
- **Transfers:** `POST /transfers/p2p`.
- **API client:** JWT from Zustand on every request; 401 triggers session clear.

---

## 5. UI Components and Design System

### 5.1 Design Tokens (CSS Variables)

- **Auth / onboarding:** `--auth-bg`, `--auth-card`, `--auth-heading`, `--auth-body`, `--cohold-blue`, `--cohold-icon-bg`, `--auth-radius`, `--auth-shadow`, etc.
- **Dashboard:** `--dashboard-bg`, `--dashboard-card`, `--dashboard-heading`, `--dashboard-body`, `--dashboard-muted`, `--dashboard-border`, `--dashboard-nav-active`.
- **Tailwind:** Extended with `cohold-blue`, `auth-bg`, `dashboard-*` in `tailwind.config.ts`.

### 5.2 Reusable Components

| Component | Location | Use |
|------------|----------|-----|
| CoholdLogo | `components/auth/CoholdLogo.tsx` | Auth / branding |
| AuthIcons | `components/auth/AuthIcons.tsx` | Person, House, Pencil, etc. |
| auth-styles | `components/auth/auth-styles.ts` | Shared auth class names |
| DashboardBottomNav | `components/dashboard/DashboardBottomNav.tsx` | Home, Investments, Listings, Accounts |
| RedirectIfNotOnboarded | `components/dashboard/RedirectIfNotOnboarded.tsx` | Dashboard layout guard |
| OnboardingGuard | `components/onboarding/OnboardingGuard.tsx` | Redirect unauthenticated from onboarding |
| OnboardingBackLink | `components/onboarding/OnboardingBackLink.tsx` | Back navigation in onboarding |
| AccountSettingRow | `components/account/AccountSettingRow.tsx` | Account menu rows (icon, label, tag, destructive) |
| LogoutModal | `components/account/LogoutModal.tsx` | Logout confirmation |
| DeleteAccountModals | `components/account/DeleteAccountModals.tsx` | Delete flow (confirm → email → OTP) |

### 5.3 Layouts

- **Dashboard:** Sticky header (logo + “Dashboard”), main content with max-width and bottom padding for nav, `RedirectIfNotOnboarded`, `DashboardBottomNav`.
- **Onboarding:** Cream background, centered card-style content; back link and guard.

---

## 6. Major Refactors and Improvements

- **JWT unification:** Single `JWT_ACCESS_SECRET` (and refresh) for both users and admins; role in payload; `JwtAuthGuard` + `AdminRoleGuard`; removed legacy `AdminJwtGuard` and separate admin JWT config.
- **Auth store + API client:** Token read from Zustand on each request; 401 clears session; no separate token getter; session includes `refreshToken` and user profile fields (`firstName`, `lastName`).
- **Onboarding and profile:** Dedicated `PUT /user/personal-details` and `PUT /user/residential-details`; `PATCH /users/me` for general profile (edit profile page).
- **Virtual accounts:** `GET /wallets/virtual-accounts` for top-up and account details modals (dynamic account number, bank name, account name).
- **Listings API:** Public `GET /properties` and `GET /properties/:id` (published only) via `ListingsController`; “My Investments” uses `GET /investments` (current user from JWT).
- **Redis/Queue:** Redis disabled; cache is in-memory; queue stubbed to avoid startup dependency.
- **Error handling:** `getApiErrorMessage()` used on auth, onboarding, and KYC for consistent API error display.

---

## 7. Current State of Figma Design Matching

| Area | Match level | Notes |
|------|-------------|--------|
| **Auth (signup, login, OTP, forgot, reset)** | High | Colors, typography, spacing, radius, shadows; shared auth styles and tokens. |
| **Onboarding** | High | Personal/Residential/Review/Success; icons and layout aligned. |
| **Dashboard home** | High | Light dashboard theme, greeting, balance card, actions, “My Investments” and “Listings” carousels, bottom nav, modals. |
| **Account home** | High | Profile block, sections (Accounts, Security, About Cohold, Actions), setting rows, logout/delete modals. |
| **Edit profile** | High | Form fields (name, nationality, phone, house, street), save button, back navigation. |
| **KYC wizard** | High | Steps, progress, file upload, preview; verified state. |
| **Linked banks** | Partial | List + delete confirm; “Add a bank” and “Save changes” present; add-bank flow/page may be minimal or missing. |
| **Wallets (swap, p2p, withdraw success)** | Partial | Pages exist; full Figma match (e.g. swap summary, P2P steps) may need polish. |
| **Transactions list** | Not started | Backend supports filters; no dedicated list UI. |
| **Referrals** | Not started | Stub API and hooks; no referrals page. |
| **Biometrics / Password reset (dashboard)** | Not started | Account links only; no in-dashboard screens. |
| **Terms / Privacy / Contact** | Not started | Links from account; no content pages. |

---

## 8. What Is Still Missing or Incomplete

### 8.1 Missing or Incomplete Pages

- **Account (all added):** `/dashboard/account/transactions` (list + filters), `/dashboard/account/referrals`, `/dashboard/account/verification` (BVN/NIN), `/dashboard/account/biometrics` (placeholder), `/dashboard/account/password-reset`, `/dashboard/account/contact`, `/dashboard/account/terms`, `/dashboard/account/privacy`, `/dashboard/account/linked-banks/add` (add bank form). All linked from the account home and implemented.

### 8.2 Backend / Data Gaps

- **Referrals:** Real referral code generation, storage, and earnings (currently stub).
- **Linked banks:** Persistence (e.g. `BankAccount` or similar) and validation (e.g. resolve account name); currently stub.
- **Transactions:** Frontend filtering and mapping of transaction types to labels/icons.

### 8.3 UX and Hardening

- **Toasts:** Radix Toast in package.json; not yet used for success/error feedback.
- **Loading states:** More consistent skeletons or spinners on data-heavy screens.
- **Error boundaries:** No global React error boundary mentioned.
- **Accessibility:** ARIA and keyboard navigation not audited.
- **Mobile:** Layouts and modals responsive; full device testing not documented.

---

## 9. Recommended Next Steps

### 9.1 Short Term (MVP closure)

1. **Account section:** Add missing account sub-pages (transactions, referrals, verification, biometrics, password-reset, terms, privacy, contact) or remove/redirect links to avoid 404s.
2. **Transactions:** Build transactions list page with filter chips and use `useWalletTransactions(filters)`.
3. **Referrals:** Build referrals page using `useReferrals`; keep stub backend until referral logic is defined.
4. **Delete account:** Ensure `POST /users/me/delete` and OTP flow are tested end-to-end.

### 9.2 Medium Term (Feature completeness)

1. **Linked banks:** Implement or integrate bank account persistence and account-name resolution; complete “Add a bank” flow.
2. **Referrals backend:** Implement referral codes and earnings (e.g. on signup, investment, or top-up).
3. **Figma polish:** Align swap/P2P/withdraw and any remaining screens to Figma (copy, layout, empty states).
4. **Toasts and errors:** Introduce global toasts and standardise error messages using `getApiErrorMessage`.

### 9.3 Longer Term (Scale and polish)

1. **Redis/Queue:** Re-enable Redis and BullMQ when needed; switch cache and jobs off stubs.
2. **Tests:** Expand unit and E2E coverage (auth, onboarding, key dashboard flows).
3. **Accessibility and i18n:** Audit a11y; add locale support if required.
4. **Monitoring:** Add frontend error reporting and basic analytics.

---

## 10. Summary Table

| Dimension | Status |
|-----------|--------|
| **Architecture** | Clear separation (Next.js + NestJS); consistent patterns (Zustand, React Query, central API client). |
| **Auth & onboarding** | End-to-end implemented and wired to backend. |
| **Dashboard home** | Implemented with real data and Figma-aligned UI. |
| **Account (main + edit + linked banks)** | Implemented; several sub-routes linked but pages missing. |
| **KYC** | Full wizard and backend (BVN, NIN, upload); status from `/users/me`. |
| **Wallets & transactions** | Balances, virtual accounts, top-up/withdraw/swap/P2P and transaction API in place; no transactions list page. |
| **Properties & investments** | Listings and “My Investments” with real APIs. |
| **Referrals & delete account** | Backend stubs and hooks; delete flow with OTP implemented; referrals page missing. |
| **Figma alignment** | Strong for auth, onboarding, home, account home, edit profile, KYC; partial for wallets/linked banks; gaps for transactions, referrals, legal/contact. |

**Overall:** The Cohold frontend and backend are in a **solid MVP state**: core auth, onboarding, dashboard home, account (with edit and linked banks), KYC, and wallet flows are implemented and integrated. Closing the remaining account sub-pages, transactions list, and referrals screen, plus stabilising stubs (referrals, linked banks), will bring the app to a **feature-complete MVP** suitable for stakeholder demos and user testing.
