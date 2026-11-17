import Decimal from "decimal.js";
import { D } from "@/lib/money";

/**
 * Debts: a principal and its repayments. Borrowing brings money in (DEBT_IN), repaying takes it out (DEBT_OUT);
 * lending is the mirror image. None of it is income or an expense, so the month figures never see it.
 */

export type DebtDirectionCode = "BORROWED" | "LENT";
export type DebtRole = "principal" | "repayment";

/** The transaction type of a debt's money move: money in for the principal of a borrowed debt and the repayments of a lent one. */
export function debtTransactionType(direction: DebtDirectionCode, role: DebtRole): "DEBT_IN" | "DEBT_OUT" {
  const moneyIn = (direction === "BORROWED") === (role === "principal");
  return moneyIn ? "DEBT_IN" : "DEBT_OUT";
}

export function debtRoleOf(metadata: unknown): DebtRole | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const role = (metadata as Record<string, unknown>).debtRole;
  return role === "principal" || role === "repayment" ? role : null;
}

type DebtTx = { type: string; amount: Decimal.Value | { toString(): string }; archivedAt?: Date | null; metadata?: unknown };

/** What has been repaid so far and what is left; only active repayment moves count. */
export function debtBalance(debt: { amount: Decimal.Value | { toString(): string } }, transactions: DebtTx[]) {
  const principal = D(debt.amount.toString());
  const repaid = transactions
    .filter((item) => !item.archivedAt && debtRoleOf(item.metadata) === "repayment")
    .reduce((sum, item) => sum.plus(item.amount.toString()), new Decimal(0));
  const left = Decimal.max(principal.minus(repaid), 0);
  return { principal, repaid, left, closed: left.lte(0) };
}

/** A UAH figure in USDT at the given rate; USD and USDT are taken one to one, as everywhere on the site. */
export function toUsdt(amount: Decimal.Value, currency: string, rate: Decimal.Value) {
  return currency === "UAH" ? D(amount).div(rate) : D(amount);
}

/** The two debt totals in USDT: what the user owes and what the user is owed. */
export function debtTotals(debts: { direction: DebtDirectionCode; currency: string; left: Decimal.Value }[], rate: Decimal.Value) {
  let owedUsdt = new Decimal(0);
  let owedToMeUsdt = new Decimal(0);
  for (const debt of debts) {
    const value = toUsdt(debt.left, debt.currency, rate);
    if (debt.direction === "BORROWED") owedUsdt = owedUsdt.plus(value);
    else owedToMeUsdt = owedToMeUsdt.plus(value);
  }
  return { owedUsdt, owedToMeUsdt };
}

/** Net capital = the whole bank + property + money others owe the user − the user's own debts. */
export function netCapital(input: { bankUsdt: Decimal.Value; assetsUsdt: Decimal.Value; owedUsdt: Decimal.Value; owedToMeUsdt: Decimal.Value }) {
  return D(input.bankUsdt).plus(input.assetsUsdt).plus(input.owedToMeUsdt).minus(input.owedUsdt);
}

/** «Взято в борг», «Погашення боргу», «Дано в борг», «Повернули борг». */
export function debtMoveLabel(type: string, metadata: unknown) {
  const role = debtRoleOf(metadata);
  if (type === "DEBT_IN") return role === "repayment" ? "Повернули борг" : "Взято в борг";
  if (type === "DEBT_OUT") return role === "repayment" ? "Погашення боргу" : "Дано в борг";
  return null;
}
