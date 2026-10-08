---
name: feelky
description: "Read the user's personal finances from Feelky (balances, spending, income, flips, transactions) and record their closed forex (FX) trades. FX trades are the only thing it can write."
homepage: https://feelky.vercel.app
metadata:
  {
    "openclaw":
      {
        "requires": { "bins": ["curl"] },
      },
  }
---

# Feelky

Feelky is the user's personal finance tracker. Use this skill whenever they ask about
their money: balances, how much they spent or earned, a category, a month, flips, P2P
withdrawals, savings, or "how am I doing" - and to record **closed FX trades**.

Everything except FX trades is **read-only**. Expenses, income and transfers cannot be
added here - for those, tell the user to use their Feelky Telegram bot.

## Access

The token lives in `~/.openclaw/feelky-token`; the commands below read it directly.
Never print it, echo it or put it in a reply.

## Summary for a month

```bash
curl -s -H "Authorization: Bearer $(cat ~/.openclaw/feelky-token)" \
  "https://feelky.vercel.app/api/agent/summary"
```

Add `?month=2026-09` for a specific month; without it you get the current one.

Returns:

- `accounts` - every account with `balance`, `currency`, `type` and `isReserved`.
  Reserved accounts (savings, the tithe jar «Десятина») are set aside: count them in the
  full bank, never as money available to spend. `type: BROKER` is the FX broker.
- `totals` - `availableBankUsdt`, `potentialBankUsdt`, `monthIncomeUsdt`,
  `monthExpenseUah`, `monthlyExpenseLimitUah`, `cardUah`, `cashUah`, `cashUsd`,
  `savingsUah` (all reserved UAH), `brokerUsdt`, `cryptoUsdt`, `netPnlUsdt`
- `expensesByCategoryUah` - personal spending by category (work expenses excluded)
- `workExpensesByDirectionUsdt` - work expenses by income direction, in USDT
- `incomeBySourceUah`, `incomeBySourceUsdt`
- `flips` - `monthPnlUsdt`, `totalPnlUsdt`, `count`, `winRatePercent`, `bySetup`
- `expectedMoney` - frozen or expected money not yet received
- `rate.uahPerUsdt` - the UAH/USDT rate the site uses

## Transactions

```bash
curl -s -H "Authorization: Bearer $(cat ~/.openclaw/feelky-token)" \
  "https://feelky.vercel.app/api/agent/transactions?from=2026-09-01&to=2026-09-19&limit=100"
```

- `from`, `to` - `YYYY-MM-DD`, Kyiv calendar days, inclusive. Default: the last 30 days.
- `limit` - default 50, max 200.
- `type` - optional: `EXPENSE`, `INCOME`, `P2P_WITHDRAWAL`, `CASH_WITHDRAWAL`,
  `TRANSFER`, `MANUAL_ADJUSTMENT`.

Each item has `date` (Kyiv time), `typeLabel`, `amount`, `currency`, `fromAccount`,
`toAccount`, `category`, `incomeSource`, `isWorkExpense`, `note`. For P2P and cash
withdrawals `amount` is the USDT spent and `receivedAmount` is what arrived.

## FX trades (the one thing you write)

Record a trade only after it is **closed**, and only with figures the user or the broker
gave you. Never estimate a PnL.

```bash
curl -s -X POST -H "Authorization: Bearer $(cat ~/.openclaw/feelky-token)" \
  -H "Content-Type: application/json" \
  "https://feelky.vercel.app/api/agent/fx/trades" \
  -d '{"externalId":"12345678","instrument":"EURUSD","side":"BUY","lots":"0.5",
       "openPrice":"1.0832","closePrice":"1.0871","openedAt":"2026-10-08T09:15:00+03:00",
       "closedAt":"2026-10-08T14:40:00+03:00","pnl":"195.00","commission":"-3.50",
       "swap":"0","setup":"breakout","note":"London open"}'
```

- Required: `instrument`, `side` (`BUY`/`SELL`), `closedAt`, `pnl`.
- `pnl` is the **net** result after commission and swap, in the broker account currency
  (USD). It is added to the broker balance - a loss is negative, e.g. `"-40.50"`.
- Always send `externalId` (the broker ticket number). Resending the same one is safe:
  the answer is `{"duplicate": true}` and nothing is recorded twice.
- Send numbers as strings. Times in ISO 8601 with an offset; `closedAt` cannot be in the future.
- `201` = recorded, `200` + `duplicate` = already there, `422` = invalid fields (read
  `issues`), `409` = no broker account yet.

Remove a mistaken trade (its PnL is taken back off the broker balance):

```bash
curl -s -X DELETE -H "Authorization: Bearer $(cat ~/.openclaw/feelky-token)" \
  "https://feelky.vercel.app/api/agent/fx/trades?externalId=12345678"
```

List trades: `GET /api/agent/fx/trades?from=2026-10-01&to=2026-10-31&limit=100`.

FX statistics: `GET /api/agent/fx/summary` - `totalPnl`, `monthPnl`, `winRate`,
`profitFactor`, `avgWin`, `avgLoss`, `commission`, `swap`, `best`, `worst`,
`byInstrument`, `bySetup`, `recent`, and `brokers` with their balances.

After recording, confirm briefly: instrument, side, PnL. Never record the same trade under
a different `externalId`.

## Rules

- Quote numbers exactly as returned. They are decimal strings - do not round away
  precision unless the user asks for a rough figure.
- Prefer the totals the API already computed over adding things up yourself.
- Always state the currency. UAH, USDT and USD are different things.
- Convert currencies only with `rate.uahPerUsdt`, and say that you converted.
- Work expenses are business costs, not personal spending - keep them apart.
- `MANUAL_ADJUSTMENT` is a balance correction, not income or spending.
- Reserved accounts are not spendable money. Transfers between the user's own accounts
  (card ↔ jar) are neither income nor spending.
- On `401` or `503` say that Feelky access is not configured. Do not retry in a loop.
- Answer in the user's language (usually Ukrainian), briefly, without emoji.
