# Cohold money ledger (production notes)

## Separation of concerns

| Concern | Storage | Notes |
|--------|---------|--------|
| Liquid user cash | `Wallet` per `(userId, currency)` | Real users only |
| Platform revenue | `Wallet` for `userId = PLATFORM_USER` | Fees aggregate here |
| Property principal (escrow) | `Wallet` for `userId = ESCROW_PROPERTY_<propertyId>` | Not withdrawable by users |
| Investment position | `Investment` | `amount` = principal, `shares`, `totalReturns` (cumulative net ROI) |

We intentionally **do not** duplicate a single `User.walletBalance` — balances are **per currency** via `Wallet`.

## Transaction types

- **BUY** — User wallet debit for fractional purchase (`amount` = total charge, `fee` = 2% fee, `netAmount` = principal to escrow).
- **SELL** — User wallet credit for sale (`amount` = gross sale, `fee` = profit-based fee, `netAmount` = to user).
- **ROI** — Rental/yield credit from monthly automation.
- **PROPERTY_FUNDING** — Escrow leg (credit on buy, debit on sell / ROI funding).
- **FEE** — Platform legs.
- **INVESTMENT** — Legacy rows only (older buys).

## Flows

### Buy (fee on top)

`investmentAmount + fee = totalCharge` debited from user; `investmentAmount` to property escrow; `fee` to platform. `Property.sharesSold` / `currentRaised` updated under row locks.

### Sell (profit-only fee)

FIFO across `Investment` rows for `(userId, propertyId)`.  
`costBasis` from average cost per position slice; `fee = 10% * max(profit, 0)`; `netToUser = sellAmount - fee`. Escrow must cover `sellAmount`.

### Monthly ROI

`distributeMonthlyRentalYield(propertyId)` — requires `Property.annualYield`.  
`roiGross = principal * (annualYield/12)`; platform takes 3% of gross; net to user. Escrow debited by total gross.

## Migrations

Run: `npx prisma migrate deploy` (or `migrate dev` locally) after pulling.
