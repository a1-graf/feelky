import Decimal from "decimal.js";

/** Fixed size of 1R in the broker currency: the planned risk of one trade (1% of the 510 USD deposit). */
export const DEFAULT_ONE_R_USD = "5.10";

/** `FX_ONE_R_USD` overrides the default; anything that is not a positive number falls back to it. */
export function getOneRUsd(): Decimal {
  const raw = process.env.FX_ONE_R_USD?.trim();
  if (raw) {
    try {
      const value = new Decimal(raw);
      if (value.isFinite() && value.gt(0)) return value;
    } catch {
      // fall through to the default
    }
  }
  return new Decimal(DEFAULT_ONE_R_USD);
}
