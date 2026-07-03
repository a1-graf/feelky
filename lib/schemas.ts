import { z } from "zod";
import { isOpeningBalanceDateInput, OPENING_BALANCE_DATE, parseDateInput } from "@/lib/transaction-utils";

export const currencySchema = z.enum(["UAH", "USDT", "USD"]);
export const dateString = z.coerce.date();

export const accountSchema = z.object({
  type: z.enum(["EXCHANGE", "EXCHANGE_SUBACCOUNT", "BANK_CARD", "CASH", "CRYPTO_WALLET", "OTHER"]),
  name: z.string().min(1),
  provider: z.string().optional().nullable(),
  currency: currencySchema,
  initialBalance: z.coerce.number().default(0),
  note: z.string().optional().nullable(),
  parentAccountId: z.string().optional().nullable()
});

export const incomeSchema = z.object({
  amount: z.coerce.number().positive(),
  currency: z.enum(["UAH", "USDT"]),
  transactionDate: z.union([z.string(), z.date()]).optional().nullable(),
  incomeSourceId: z.string().min(1),
  destinationAccountId: z.string().min(1),
  note: z.string().optional().nullable()
}).transform((input, context) => {
  const isOpeningBalance = isOpeningBalanceDateInput(input.transactionDate);
  const transactionDate = isOpeningBalance ? OPENING_BALANCE_DATE : parseDateInput(input.transactionDate);
  if (Number.isNaN(transactionDate.getTime())) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Некоректна дата" });
  }
  return { ...input, transactionDate, isOpeningBalance };
});

export const expenseSchema = z.object({
  amount: z.coerce.number().positive(),
  currency: z.enum(["UAH", "USDT"]).default("UAH"),
  transactionDate: dateString.default(() => new Date()),
  categoryId: z.string().min(1),
  sourceAccountId: z.string().min(1),
  note: z.string().optional().nullable()
});

export const p2pWithdrawalSchema = z.object({
  receivedUah: z.coerce.number().positive(),
  rateUahPerUsdt: z.coerce.number().positive(),
  transactionDate: dateString.default(() => new Date()),
  note: z.string().optional().nullable()
});

export const cashWithdrawalSchema = z.object({
  receivedAmount: z.coerce.number().positive(),
  receivedCurrency: z.enum(["UAH", "USD"]),
  rate: z.coerce.number().positive(),
  transactionDate: dateString.default(() => new Date()),
  exchangePlace: z.string().default("Cashalot"),
  note: z.string().optional().nullable()
});

export const expectedMoneySchema = z.object({
  title: z.string().trim().min(1).default("Заморожені бабки"),
  amount: z.coerce.number().positive(),
  currency: currencySchema,
  status: z.enum(["EXPECTED", "NEED_TO_COLLECT", "IN_PROGRESS", "RECEIVED", "LOST", "SCAMMED"]).default("EXPECTED"),
  note: z.string().optional().nullable(),
  expectedDate: z.coerce.date().optional().nullable()
});

export const freezeFundsSchema = z.object({
  accountId: z.string().min(1),
  amount: z.coerce.number().positive(),
  currency: currencySchema,
  frozenDate: dateString.default(() => new Date()),
  note: z.string().optional().nullable()
});

export const manualAdjustmentSchema = z.object({
  accountId: z.string().min(1),
  newBalance: z.coerce.number().min(0),
  note: z.string().optional().nullable()
});

export const flipSchema = z.object({
  setup: z.string().trim().min(1),
  pnl: z.coerce.number(),
  tradeDate: dateString.default(() => new Date()),
  note: z.string().optional().nullable()
});

export const transactionFiltersSchema = z.object({
  q: z.string().optional(),
  type: z.string().optional(),
  currency: z.string().optional(),
  status: z.string().optional(),
  accountId: z.string().optional(),
  categoryId: z.string().optional(),
  incomeSourceId: z.string().optional(),
  archived: z.coerce.boolean().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(20)
});
