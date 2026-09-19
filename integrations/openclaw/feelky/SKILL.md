---
name: feelky
description: "Read the user's personal finances from Feelky: account balances, spending by category, income, work expenses, flips PnL, expected money and the transaction list. Read-only."
homepage: https://feelky.vercel.app
metadata:
  {
    "openclaw":
      {
        "requires": { "bins": ["curl"] },
      },
  }
---

# Feelky (read-only)

Feelky is the user's personal finance tracker. Use this skill whenever they ask about
their money: balances, how much they spent or earned, a category, a month, flips, P2P
withdrawals, savings, or "how am I doing".

It is strictly **read-only**. There is no way to add, change or delete anything through
it - if the user wants to record an operation, tell them to use their Feelky Telegram bot.

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

- `accounts` - every account with its current `balance` and `currency`
- `totals` - `availableBankUsdt`, `potentialBankUsdt`, `monthIncomeUsdt`,
  `monthExpenseUah`, `monthlyExpenseLimitUah`, `cardUah`, `cashUah`, `cashUsd`,
  `savingsUah`, `cryptoUsdt`, `netPnlUsdt`
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

## Rules

- Quote numbers exactly as returned. They are decimal strings - do not round away
  precision unless the user asks for a rough figure.
- Prefer the totals the API already computed over adding things up yourself.
- Always state the currency. UAH, USDT and USD are different things.
- Convert currencies only with `rate.uahPerUsdt`, and say that you converted.
- Work expenses are business costs, not personal spending - keep them apart.
- `MANUAL_ADJUSTMENT` is a balance correction, not income or spending.
- On `401` or `503` say that Feelky access is not configured. Do not retry in a loop.
- Answer in the user's language (usually Ukrainian), briefly, without emoji.
