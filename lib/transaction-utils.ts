import type { TransactionType } from "@prisma/client";

export const OPENING_BALANCE_DATE = new Date("1970-01-01T00:00:00.000Z");

export function isOpeningBalanceDateInput(value: unknown) {
  if (typeof value !== "string") return false;
  return value.replace(/\D/g, "") === "00000000";
}

export function parseDateInput(value: unknown, fallback = new Date()) {
  if (value instanceof Date) return value;
  if (value == null || value === "") return fallback;
  const text = String(value).trim();
  const dmy = /^(\d{2})[./](\d{2})[./](\d{4})$/.exec(text);
  if (dmy) return new Date(`${dmy[3]}-${dmy[2]}-${dmy[1]}T00:00:00.000`);
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (ymd) return new Date(`${ymd[1]}-${ymd[2]}-${ymd[3]}T00:00:00.000`);
  return new Date(text);
}

export function isOpeningBalanceTransaction(transaction: {
  type?: TransactionType | string;
  metadata?: unknown;
}) {
  if (transaction.type !== "INCOME") return false;
  const metadata = transaction.metadata;
  return Boolean(metadata && typeof metadata === "object" && !Array.isArray(metadata) && (metadata as Record<string, unknown>).isOpeningBalance === true);
}

export function isSavingsDepositTransaction(transaction: {
  type?: TransactionType | string;
  metadata?: unknown;
}) {
  if (transaction.type !== "TRANSFER") return false;
  const metadata = transaction.metadata;
  return Boolean(metadata && typeof metadata === "object" && !Array.isArray(metadata) && (metadata as Record<string, unknown>).isSavingsDeposit === true);
}
