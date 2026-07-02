import Decimal from "decimal.js";
import { D } from "@/lib/money";

export function steamFrozenCapital(input: { activeResale: Decimal.Value; activeArbitrage: Decimal.Value; openResiduals: Decimal.Value }) {
  return D(input.activeResale).plus(input.activeArbitrage).plus(input.openResiduals);
}

export function withdrawalLoss(softwareAmountSpent: Decimal.Value, amountReceived: Decimal.Value) {
  return D(softwareAmountSpent).minus(amountReceived);
}

export function percent(part: Decimal.Value, whole: Decimal.Value) {
  const denominator = D(whole);
  if (denominator.lte(0)) return new Decimal(0);
  return D(part).div(denominator).mul(100);
}

export function resaleGrossResult(input: { endingBalance: Decimal.Value; softwareSpent: Decimal.Value; startingBalance: Decimal.Value; receivedSteamAmount: Decimal.Value }) {
  return D(input.endingBalance).plus(input.softwareSpent).minus(input.startingBalance).minus(input.receivedSteamAmount);
}

export function arbitrageProfit(input: { finalAmountReceived: Decimal.Value; investedAmount: Decimal.Value; expenses: Decimal.Value; withdrawnResiduals?: Decimal.Value }) {
  return D(input.finalAmountReceived).plus(input.withdrawnResiduals || 0).minus(input.investedAmount).minus(input.expenses);
}

export function allocationIsValid(resalePercent: Decimal.Value, arbitragePercent: Decimal.Value) {
  return D(resalePercent).plus(arbitragePercent).eq(100);
}
