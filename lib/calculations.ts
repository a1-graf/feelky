import Decimal from "decimal.js";
import { calculateSpentUsdt, D, roundCurrency } from "@/lib/money";

export type AccountSnapshot = {
  id: string;
  currency: "UAH" | "USDT" | "USD";
  balance: Decimal.Value;
  frozen?: Decimal.Value;
  kind: "crypto" | "card" | "cash";
};

export type ExpectedSnapshot = {
  currency: "UAH" | "USDT" | "USD";
  amount: Decimal.Value;
  active: boolean;
};

export function p2pCalculation(receivedUah: Decimal.Value, rateUahPerUsdt: Decimal.Value) {
  return {
    receivedUah: roundCurrency(receivedUah, "UAH"),
    spentUsdt: calculateSpentUsdt(receivedUah, rateUahPerUsdt),
    rate: D(rateUahPerUsdt)
  };
}

export function cashWithdrawalCalculation(receivedAmount: Decimal.Value, receivedCurrency: "UAH" | "USD", rate: Decimal.Value) {
  return {
    receivedAmount: roundCurrency(receivedAmount, receivedCurrency),
    receivedCurrency,
    spentUsdt: calculateSpentUsdt(receivedAmount, rate),
    rate: D(rate)
  };
}

export function availableBankUsdt(accounts: AccountSnapshot[], uahUsdtRate: Decimal.Value) {
  const rate = D(uahUsdtRate);
  return accounts.reduce((sum, account) => {
    const balance = D(account.balance);
    const frozen = D(account.frozen || 0);
    const available = balance.minus(frozen);
    if (account.currency === "USDT") return sum.plus(available);
    if (account.currency === "USD") return sum.plus(available);
    return sum.plus(available.div(rate));
  }, new Decimal(0));
}

export function potentialBankUsdt(accounts: AccountSnapshot[], expected: ExpectedSnapshot[], uahUsdtRate: Decimal.Value) {
  const rate = D(uahUsdtRate);
  const available = availableBankUsdt(accounts, rate);
  const frozen = accounts.reduce((sum, account) => {
    const amount = D(account.frozen || 0);
    if (account.currency === "UAH") return sum.plus(amount.div(rate));
    return sum.plus(amount);
  }, new Decimal(0));
  const activeExpected = expected.filter((item) => item.active).reduce((sum, item) => {
    if (item.currency === "UAH") return sum.plus(D(item.amount).div(rate));
    return sum.plus(item.amount);
  }, new Decimal(0));
  return available.plus(frozen).plus(activeExpected);
}

export function editEffect(previousDelta: Decimal.Value, nextDelta: Decimal.Value) {
  return D(nextDelta).minus(previousDelta);
}

export function archiveEffect(activeDelta: Decimal.Value) {
  return D(activeDelta).negated();
}

export function restoreEffect(activeDelta: Decimal.Value) {
  return D(activeDelta);
}
