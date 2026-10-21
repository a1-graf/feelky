import { z } from "zod";
import { decimalString, MAX_FUTURE_SKEW_MS } from "@/lib/fx-input";
import { inferMarketKind, POLY_MARKET_KINDS, POLY_SECTIONS } from "@/lib/poly-stats";

/** Validation for Polymarket trades and pool operations an agent sends. Money stays a decimal string. */

export const MAX_POLY_BATCH = 200;

const emptyToNull = (value: unknown) => (value === "" ? null : value);
const optionalDecimal = z.preprocess(emptyToNull, decimalString.optional().nullable());
const optionalPositive = optionalDecimal.refine((value) => value == null || (!value.startsWith("-") && Number(value) > 0), "Має бути додатним");
const optionalNonNegative = optionalDecimal.refine((value) => value == null || !value.startsWith("-"), "Не може бути від'ємним");
const optionalText = (max: number) => z.string().trim().max(max).optional().nullable().transform((value) => value || null);
const upper = (value: unknown) => (typeof value === "string" ? value.trim().toUpperCase().replace(/[\s-]+/g, "_") : value);
const optionalDate = z.preprocess(emptyToNull, z.coerce.date().optional().nullable());

const price = z
  .preprocess((value) => value, decimalString)
  .refine((value) => Number(value) > 0 && Number(value) <= 1, "Ціна — від 0 до 1 (частка долара)");

export const polyTradeInputSchema = z
  .object({
    externalId: z.string().trim().min(1, "externalId обов'язковий").max(120),
    section: z.preprocess(upper, z.enum(["MANUAL", "COPYTRADE", "AI_AGENT"] as [string, ...string[]])),
    agentName: optionalText(60),
    walletRef: optionalText(80),
    marketSlug: z.string().trim().min(1).max(200),
    title: optionalText(300),
    marketKind: z.preprocess((value) => (value === "" || value == null ? undefined : upper(value)), z.enum(POLY_MARKET_KINDS as [string, ...string[]]).optional()),
    outcome: z.string().trim().min(1).max(60),
    entryPrice: price,
    sizeUsd: decimalString.refine((value) => Number(value) > 0, "Розмір має бути більшим за нуль"),
    shares: optionalPositive,
    feesUsd: optionalNonNegative,
    status: z.preprocess((value) => (value === "" || value == null ? undefined : upper(value)), z.enum(["OPEN", "WON", "LOST", "VOID"]).optional()),
    /** Net result after fees. Omitted for WON/LOST/VOID it is computed from price, size and shares. */
    pnl: optionalDecimal,
    openedAt: z.coerce.date(),
    resolvedAt: optionalDate,
    signalPrice: z.preprocess(emptyToNull, price.optional().nullable()),
    note: optionalText(500)
  })
  .superRefine((trade, context) => {
    if (trade.openedAt.getTime() > Date.now() + MAX_FUTURE_SKEW_MS) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["openedAt"], message: "Угода не може бути відкрита в майбутньому" });
    }
    if (trade.resolvedAt && trade.resolvedAt.getTime() < trade.openedAt.getTime()) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["resolvedAt"], message: "Закриття раніше за відкриття" });
    }
    if (trade.section === "AI_AGENT" && !trade.agentName) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["agentName"], message: "Для AI-агента вкажи agentName" });
    }
    if (trade.status === "OPEN" && trade.pnl != null && Number(trade.pnl) !== 0) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["pnl"], message: "Відкрита угода ще не має результату" });
    }
  })
  .transform((trade) => {
    let status = trade.status as "OPEN" | "WON" | "LOST" | "VOID" | undefined;
    // An explicit result without a status: the sign of the PnL decides.
    if (!status) status = trade.pnl != null ? (Number(trade.pnl) > 0 ? "WON" : Number(trade.pnl) < 0 ? "LOST" : "VOID") : trade.resolvedAt ? "WON" : "OPEN";
    return {
      ...trade,
      section: trade.section as (typeof POLY_SECTIONS)[number],
      marketKind: (trade.marketKind ?? inferMarketKind(trade.marketSlug, trade.title ?? "")) as (typeof POLY_MARKET_KINDS)[number],
      title: trade.title ?? trade.marketSlug,
      status
    };
  });

export type PolyTradeInputParsed = z.output<typeof polyTradeInputSchema>;

/** One trade or an array of up to 200. */
export const polyTradesBodySchema = z.union([
  z.array(z.unknown()).min(1, "Порожній масив").max(MAX_POLY_BATCH, `Не більше ${MAX_POLY_BATCH} угод за раз`),
  z.record(z.unknown())
]);

export const polyLockInputSchema = z.object({
  amountUsd: decimalString.refine((value) => Number(value) > 0, "Сума має бути більшою за нуль"),
  agentName: z.string().trim().min(1).max(60),
  lockDays: z.coerce.number().int().min(1).max(365).default(30),
  lockedAt: optionalDate,
  note: optionalText(300)
});

export const polyReleaseInputSchema = z.object({
  lockId: z.string().trim().min(1).optional(),
  agentName: z.string().trim().min(1).max(60).optional(),
  /** What actually came back to the pool. The difference to the principal is the agent's result. */
  returnedUsd: decimalString.refine((value) => Number(value) >= 0, "Сума не може бути від'ємною"),
  releasedAt: optionalDate,
  note: optionalText(300)
});
