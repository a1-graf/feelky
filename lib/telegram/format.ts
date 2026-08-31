import type Decimal from "decimal.js";
import { roundCurrency } from "@/lib/money";
import type { TelegramCurrency } from "@/lib/telegram/parse";

export const KYIV_TIME_ZONE = "Europe/Kyiv";

/** Telegram HTML parse mode only needs these three, `"` is escaped for safety inside attributes. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function toCurrencyCode(currency: string | null | undefined): TelegramCurrency {
  return currency === "USDT" || currency === "USD" ? currency : "UAH";
}

/** `12 500 UAH`, `840.5 USDT` - trailing zeros trimmed, thousands grouped. */
export function formatAmount(value: Decimal.Value, currency: string): string {
  const code = toCurrencyCode(currency);
  const fixed = roundCurrency(value, code).toFixed(code === "USDT" ? 4 : 2);
  const trimmed = fixed.includes(".") ? fixed.replace(/\.?0+$/, "") : fixed;
  const [whole, fraction] = trimmed.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return fraction ? `${grouped}.${fraction} ${code}` : `${grouped} ${code}`;
}

export function formatKyivDateTime(date: Date): string {
  return new Intl.DateTimeFormat("uk-UA", {
    timeZone: KYIV_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

/** The stored instant is timezone independent; Kyiv is only how we render "now" to the user. */
export function kyivNow(): Date {
  return new Date();
}

export function truncate(value: string, max = 120): string {
  const clean = value.trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}…`;
}
