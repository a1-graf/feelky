import { describe, expect, it } from "vitest";
import { accountEffect } from "@/lib/ledger";
import { debtBalance, debtMoveLabel, debtTotals, debtTransactionType, netCapital, toUsdt } from "@/lib/debt-math";

const move = (type: string, amount: string, role: "principal" | "repayment", archivedAt: Date | null = null) => ({ type, amount, archivedAt, metadata: { debtRole: role } });

describe("debt math", () => {
  it("borrowing brings money in and repaying takes it out; lending is the mirror image", () => {
    expect(debtTransactionType("BORROWED", "principal")).toBe("DEBT_IN");
    expect(debtTransactionType("BORROWED", "repayment")).toBe("DEBT_OUT");
    expect(debtTransactionType("LENT", "principal")).toBe("DEBT_OUT");
    expect(debtTransactionType("LENT", "repayment")).toBe("DEBT_IN");
  });

  it("counts only active repayments and closes at zero", () => {
    const debt = { amount: "10000" };
    const partial = debtBalance(debt, [move("DEBT_IN", "10000", "principal"), move("DEBT_OUT", "3000", "repayment"), move("DEBT_OUT", "500", "repayment", new Date())]);
    expect(partial.repaid.toString()).toBe("3000");
    expect(partial.left.toString()).toBe("7000");
    expect(partial.closed).toBe(false);
    const full = debtBalance(debt, [move("DEBT_OUT", "3000", "repayment"), move("DEBT_OUT", "7000", "repayment")]);
    expect(full.left.toString()).toBe("0");
    expect(full.closed).toBe(true);
  });

  it("sums both directions in USDT and builds net capital", () => {
    const totals = debtTotals(
      [
        { direction: "BORROWED", currency: "UAH", left: "4630" },
        { direction: "BORROWED", currency: "USDT", left: "50" },
        { direction: "LENT", currency: "USD", left: "20" }
      ],
      "46.3"
    );
    expect(totals.owedUsdt.toString()).toBe("150");
    expect(totals.owedToMeUsdt.toString()).toBe("20");
    expect(toUsdt("926", "UAH", "46.3").toString()).toBe("20");
    expect(netCapital({ bankUsdt: "1000", assetsUsdt: "500", owedUsdt: totals.owedUsdt, owedToMeUsdt: totals.owedToMeUsdt }).toString()).toBe("1370");
  });

  it("debt moves change only their account, as a transfer would", () => {
    const base = { convertedAmount: null, metadata: { debtRole: "principal" } };
    expect(accountEffect({ ...base, type: "DEBT_IN", amount: "500", sourceAccountId: null, destinationAccountId: "card" }, "card").toString()).toBe("500");
    expect(accountEffect({ ...base, type: "DEBT_OUT", amount: "200", sourceAccountId: "card", destinationAccountId: null }, "card").toString()).toBe("-200");
    expect(accountEffect({ ...base, type: "DEBT_OUT", amount: "200", sourceAccountId: "card", destinationAccountId: null }, "other").toString()).toBe("0");
  });

  it("names every debt move", () => {
    expect(debtMoveLabel("DEBT_IN", { debtRole: "principal" })).toBe("Взято в борг");
    expect(debtMoveLabel("DEBT_OUT", { debtRole: "repayment" })).toBe("Погашення боргу");
    expect(debtMoveLabel("DEBT_OUT", { debtRole: "principal" })).toBe("Дано в борг");
    expect(debtMoveLabel("DEBT_IN", { debtRole: "repayment" })).toBe("Повернули борг");
    expect(debtMoveLabel("EXPENSE", null)).toBeNull();
  });
});
