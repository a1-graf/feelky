import { z } from "zod";

/**
 * Validation for trades an agent sends. Money stays a decimal string end to end - a JSON
 * number is accepted but converted, never used for arithmetic.
 */

export const decimalString = z.preprocess(
  (value) => (typeof value === "number" ? String(value) : typeof value === "string" ? value.trim().replace(/\s/g, "").replace(",", ".") : value),
  z.string().regex(/^-?\d+(\.\d+)?$/, "Очікується число")
);

const optionalDecimal = z.preprocess((value) => (value === "" ? null : value), decimalString.optional().nullable());
const optionalPositive = optionalDecimal.refine((value) => value == null || !value.startsWith("-"), "Має бути додатним");
const optionalText = (max: number) => z.string().trim().max(max).optional().nullable().transform((value) => value || null);

export const MAX_FUTURE_SKEW_MS = 24 * 60 * 60 * 1000;

export const fxTradeInputSchema = z
  .object({
    externalId: optionalText(100),
    instrument: z.string().trim().min(2).max(20).regex(/^[A-Za-z0-9._/-]+$/, "Інструмент: літери, цифри, . _ / -"),
    side: z.string().transform((value) => value.trim().toUpperCase()).pipe(z.enum(["BUY", "SELL"])),
    lots: optionalPositive,
    openPrice: optionalPositive,
    closePrice: optionalPositive,
    stopLoss: optionalPositive,
    riskAmount: optionalPositive,
    openedAt: z.preprocess((value) => (value === "" ? null : value), z.coerce.date().optional().nullable()),
    closedAt: z.coerce.date(),
    pnl: decimalString,
    commission: optionalDecimal,
    swap: optionalDecimal,
    setup: optionalText(80),
    note: optionalText(500),
    account: optionalText(80)
  })
  .superRefine((trade, context) => {
    if (trade.closedAt.getTime() > Date.now() + MAX_FUTURE_SKEW_MS) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["closedAt"], message: "Угода не може бути закрита в майбутньому" });
    }
    if (trade.openedAt && trade.openedAt.getTime() > trade.closedAt.getTime()) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["openedAt"], message: "Відкриття пізніше за закриття" });
    }
  });

export type FxTradeInputParsed = z.infer<typeof fxTradeInputSchema>;
