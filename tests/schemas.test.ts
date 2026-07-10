import { describe, expect, it } from "vitest";
import { flipSchema, incomeSchema, manualAdjustmentSchema, p2pWithdrawalSchema, savingsDepositSchema } from "@/lib/schemas";

describe("schemas", () => {
  it("accepts comma decimals from mobile keyboards", () => {
    expect(incomeSchema.parse({
      amount: "123,45",
      currency: "USDT",
      transactionDate: "2026-07-05",
      incomeSourceId: "source",
      destinationAccountId: "account"
    }).amount).toBe(123.45);

    expect(p2pWithdrawalSchema.parse({
      receivedUah: "1 234,56",
      rateUahPerUsdt: "40,5",
      transactionDate: "2026-07-05"
    })).toMatchObject({ receivedUah: 1234.56, rateUahPerUsdt: 40.5 });

    expect(flipSchema.parse({ setup: "test", pnl: "-136,5", tradeDate: "2026-07-05" }).pnl).toBe(-136.5);
    expect(manualAdjustmentSchema.parse({ accountId: "account", newBalance: "3334,775" }).newBalance).toBe(3334.775);
    expect(savingsDepositSchema.parse({ amount: "2 500,50", sourceAccountId: "card", transactionDate: "2026-07-05" }).amount).toBe(2500.5);
  });
});
