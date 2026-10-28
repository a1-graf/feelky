import { z } from "zod";
import { decimalString, MAX_FUTURE_SKEW_MS } from "@/lib/fx-input";

/** Validation for forks an agent sends. Money stays a decimal string end to end. */

const positive = decimalString.refine((value) => !value.startsWith("-") && Number(value) > 0, "Має бути додатним");
const nonNegative = decimalString.refine((value) => !value.startsWith("-"), "Не може бути від'ємним");
const optionalDecimal = z.preprocess((value) => (value === "" ? null : value), decimalString.optional().nullable());
const optionalText = (max: number) => z.string().trim().max(max).optional().nullable().transform((value) => value || null);

const legSchema = z.object({
  book: z.string().trim().min(1).max(40),
  pick: z.string().trim().min(1).max(120),
  odds: positive,
  stake: nonNegative
});

export const forkInputSchema = z
  .object({
    externalId: z.string().trim().min(1).max(100),
    status: z.string().transform((value) => value.trim().toUpperCase()).pipe(z.enum(["OPEN", "SETTLED"])),
    placedAt: z.coerce.date(),
    sport: optionalText(40),
    match: z.string().trim().min(1).max(200),
    tags: z.array(z.string().trim().min(1).max(80)).max(10).optional().default([]),
    legs: z.tuple([legSchema, legSchema]),
    total: z.preprocess((value) => (value === "" ? null : value), nonNegative.optional().nullable()),
    pnl: optionalDecimal,
    guaranteed: optionalDecimal,
    note: optionalText(500)
  })
  .superRefine((fork, context) => {
    if (fork.status === "SETTLED" && fork.pnl == null) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["pnl"], message: "Для закритої вилки потрібен pnl" });
    }
    if (fork.placedAt.getTime() > Date.now() + MAX_FUTURE_SKEW_MS) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["placedAt"], message: "Вилка не може бути в майбутньому" });
    }
  });

export type ForkInputParsed = z.infer<typeof forkInputSchema>;
