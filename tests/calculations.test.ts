import { describe, expect, it } from "vitest";
import { archiveEffect, availableBankUsdt, cashWithdrawalCalculation, editEffect, p2pCalculation, potentialBankUsdt, restoreEffect } from "@/lib/calculations";
import { D } from "@/lib/money";

describe("financial calculations", () => {
  it("parses comma decimal money input", () => {
    expect(D("1 234,56").toString()).toBe("1234.56");
  });

  it("calculates P2P spent USDT with decimal rounding", () => {
    const result = p2pCalculation("4100", "41");
    expect(result.spentUsdt.toString()).toBe("100");
  });

  it("calculates cash withdrawal for USD", () => {
    const result = cashWithdrawalCalculation("250", "USD", "1");
    expect(result.receivedAmount.toString()).toBe("250");
    expect(result.spentUsdt.toString()).toBe("250");
  });

  it("excludes frozen funds from available bank", () => {
    const value = availableBankUsdt([
      { id: "binance", kind: "crypto", currency: "USDT", balance: "1000", frozen: "200" },
      { id: "card", kind: "card", currency: "UAH", balance: "4000" },
      { id: "cash-usd", kind: "cash", currency: "USD", balance: "50" }
    ], "40");
    expect(value.toString()).toBe("950");
  });

  it("includes frozen and active expected money in potential bank", () => {
    const value = potentialBankUsdt([
      { id: "binance", kind: "crypto", currency: "USDT", balance: "1000", frozen: "200" },
      { id: "card", kind: "card", currency: "UAH", balance: "4000" }
    ], [
      { currency: "UAH", amount: "8000", active: true },
      { currency: "USDT", amount: "100", active: false }
    ], "40");
    expect(value.toString()).toBe("1300");
  });

  it("calculates archive and restore effects without double counting", () => {
    expect(archiveEffect("125").toString()).toBe("-125");
    expect(restoreEffect("125").toString()).toBe("125");
  });

  it("calculates edit delta as rollback plus new effect", () => {
    expect(editEffect("100", "60").toString()).toBe("-40");
  });
});
