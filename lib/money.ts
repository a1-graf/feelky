import Decimal from "decimal.js";

export type MoneyInput = Decimal.Value;

function normalizeMoneyInput(value: MoneyInput) {
  if (typeof value !== "string") return value;
  return value.trim().replace(/\s/g, "").replace(",", ".");
}

export const D = (value: MoneyInput) => new Decimal(normalizeMoneyInput(value || 0));

export function roundCurrency(value: MoneyInput, currency: "UAH" | "USDT" | "USD" = "UAH") {
  const places = currency === "USDT" ? 4 : 2;
  return D(value).toDecimalPlaces(places, Decimal.ROUND_HALF_UP);
}

export function toPrismaDecimal(value: MoneyInput, currency?: "UAH" | "USDT" | "USD") {
  return currency ? roundCurrency(value, currency).toString() : D(value).toString();
}

export function assertPositive(value: MoneyInput, field = "amount") {
  if (D(value).lte(0)) {
    throw new Error(`${field} must be positive`);
  }
}

export function calculateSpentUsdt(receivedAmount: MoneyInput, rate: MoneyInput) {
  assertPositive(receivedAmount, "receivedAmount");
  assertPositive(rate, "rate");
  return roundCurrency(D(receivedAmount).div(rate), "USDT");
}

export function sumDecimals(values: MoneyInput[]) {
  return values.reduce<Decimal>((total, value) => total.plus(value), new Decimal(0));
}

export function formatMoney(value: MoneyInput, currency: string, hidden = false) {
  if (hidden) return "••••";
  const amount = D(value).toNumber();
  return new Intl.NumberFormat("uk-UA", {
    minimumFractionDigits: currency === "USDT" ? 2 : 2,
    maximumFractionDigits: currency === "USDT" ? 4 : 2
  }).format(amount) + ` ${currency}`;
}
