import Decimal from "decimal.js";
import { D } from "@/lib/money";

/** Bagira keeps 40% of the profit of a session; the rest is ours. */
export const BAGIRA_FEE_RATE = "0.4";

/** Bagira's cut is taken from the profit of a whole session, never added to a loss. */
export function bagiraFee(pnl: Decimal.Value): Decimal {
  const value = D(pnl);
  return value.gt(0) ? value.mul(BAGIRA_FEE_RATE) : new Decimal(0);
}

export function netOf(pnl: Decimal.Value): Decimal {
  return D(pnl).minus(bagiraFee(pnl));
}

