import { describe, expect, it } from "vitest";
import { isOpeningBalanceDateInput, isOpeningBalanceTransaction, isSavingsDepositTransaction, isWorkExpenseTransaction, parseDateInput } from "@/lib/transaction-utils";

describe("transaction utilities", () => {
  it("recognizes zero dates as opening balance input", () => {
    expect(isOpeningBalanceDateInput("00.00.0000")).toBe(true);
    expect(isOpeningBalanceDateInput("0000-00-00")).toBe(true);
    expect(isOpeningBalanceDateInput("00 00 0000")).toBe(true);
  });

  it("parses Ukrainian date input", () => {
    const date = parseDateInput("03.07.2026");
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(6);
    expect(date.getDate()).toBe(3);
  });

  it("recognizes opening balance transaction metadata", () => {
    expect(isOpeningBalanceTransaction({ type: "INCOME", metadata: { isOpeningBalance: true } })).toBe(true);
    expect(isOpeningBalanceTransaction({ type: "INCOME", metadata: null })).toBe(false);
  });
});

describe("savings transactions", () => {
  it("recognizes only marked transfers as savings deposits", () => {
    expect(isSavingsDepositTransaction({ type: "TRANSFER", metadata: { isSavingsDeposit: true } })).toBe(true);
    expect(isSavingsDepositTransaction({ type: "TRANSFER", metadata: {} })).toBe(false);
    expect(isSavingsDepositTransaction({ type: "INCOME", metadata: { isSavingsDeposit: true } })).toBe(false);
  });
});

describe("work expense transactions", () => {
  it("recognizes only marked expenses as work expenses", () => {
    expect(isWorkExpenseTransaction({ type: "EXPENSE", metadata: { isWorkExpense: true } })).toBe(true);
    expect(isWorkExpenseTransaction({ type: "EXPENSE", metadata: {} })).toBe(false);
    expect(isWorkExpenseTransaction({ type: "INCOME", metadata: { isWorkExpense: true } })).toBe(false);
  });
});
