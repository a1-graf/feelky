import { z } from "zod";
import { decimalString } from "@/lib/fx-input";

/** A balance the agent read off a Steam wallet. Steam money is kept in dollars across the module. */

export const MAX_STEAM_BALANCE = 10_000_000;
const FUTURE_SKEW_MS = 10 * 60 * 1000;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export const steamBalanceInputSchema = z
  .object({
    account: z.string().trim().min(1).max(80),
    balance: decimalString
      .refine((value) => !value.startsWith("-"), "Баланс не може бути мінусовим")
      .refine((value) => Number(value) <= MAX_STEAM_BALANCE, "Завеликий баланс"),
    observedAt: z.preprocess((value) => (value === "" || value === null ? undefined : value), z.coerce.date().optional()),
    currency: z
      .string()
      .transform((value) => value.trim().toUpperCase().replace("$", "USD"))
      .pipe(z.enum(["USD", "USDT"], { errorMap: () => ({ message: "Баланс Steam ведеться в доларах (USD)" }) }))
      .optional()
  })
  .superRefine((input, context) => {
    if (!input.observedAt) return;
    const age = Date.now() - input.observedAt.getTime();
    if (age < -FUTURE_SKEW_MS) context.addIssue({ code: z.ZodIssueCode.custom, path: ["observedAt"], message: "Час не може бути в майбутньому" });
    if (age > MAX_AGE_MS) context.addIssue({ code: z.ZodIssueCode.custom, path: ["observedAt"], message: "Знімок старший за 7 днів" });
  });

export type SteamBalanceInput = z.infer<typeof steamBalanceInputSchema>;
