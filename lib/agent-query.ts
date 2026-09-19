import type { TransactionType } from "@prisma/client";
import { isValidDateKey, kyivToday } from "@/lib/telegram/dates";
import { KYIV_TIME_ZONE } from "@/lib/telegram/format";

/** Pure helpers for the agent API: no database, so they are unit-testable. */

export function bearerToken(header: string | null): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

export const TYPE_LABELS: Record<TransactionType, string> = {
  INCOME: "Дохід",
  EXPENSE: "Витрата",
  P2P_WITHDRAWAL: "P2P-вивід",
  CASH_WITHDRAWAL: "Вивід у готівку",
  TRANSFER: "Переказ",
  MANUAL_ADJUSTMENT: "Коригування балансу",
  EXPECTED_MONEY_RECEIVED: "Повернення очікуваних",
  FUNDS_FROZEN: "Заморожено",
  FUNDS_RELEASED: "Розморожено"
};

export function kyivStamp(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: KYIV_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}

/** Offset of Kyiv from UTC in minutes on a given day (+120 in winter, +180 in summer). */
function kyivOffsetMinutes(dateKey: string): number {
  const probe = new Date(`${dateKey}T12:00:00.000Z`);
  const name = new Intl.DateTimeFormat("en-US", { timeZone: KYIV_TIME_ZONE, timeZoneName: "shortOffset" })
    .formatToParts(probe)
    .find((part) => part.type === "timeZoneName")?.value || "GMT+2";
  const match = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(name);
  if (!match) return 120;
  const minutes = Number(match[2]) * 60 + Number(match[3] || 0);
  return match[1] === "-" ? -minutes : minutes;
}

/** Start of a Kyiv calendar day as an instant. */
export function kyivDayStart(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day) - kyivOffsetMinutes(dateKey) * 60_000);
}

export type TransactionQuery = {
  from: Date;
  to: Date;
  limit: number;
  type: TransactionType | null;
};

export const DEFAULT_TRANSACTION_DAYS = 30;
export const MAX_TRANSACTION_LIMIT = 200;

/** Parses `from`, `to` (YYYY-MM-DD, Kyiv days, inclusive), `type` and `limit` with safe defaults. */
export function parseTransactionQuery(params: URLSearchParams, now: Date = new Date()): TransactionQuery {
  const today = kyivToday(now);
  const toKey = params.get("to") && isValidDateKey(params.get("to") as string) ? (params.get("to") as string) : today;
  const defaultFrom = new Date(kyivDayStart(toKey).getTime() - (DEFAULT_TRANSACTION_DAYS - 1) * 86_400_000);
  const fromKey = params.get("from");
  const from = fromKey && isValidDateKey(fromKey) ? kyivDayStart(fromKey) : defaultFrom;
  const toExclusive = new Date(kyivDayStart(toKey).getTime() + 86_400_000);
  const rawLimit = Number(params.get("limit"));
  const limit = Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, MAX_TRANSACTION_LIMIT) : 50;
  const rawType = (params.get("type") || "").toUpperCase();
  const type = rawType in TYPE_LABELS ? (rawType as TransactionType) : null;
  return { from, to: new Date(toExclusive.getTime() - 1), limit, type };
}
