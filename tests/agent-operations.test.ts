import { describe, expect, it } from "vitest";
import { agentOperationSchema } from "@/lib/agent-operations";

describe("agent operations input", () => {
  it("reads an expense with defaults left out", () => {
    const parsed = agentOperationSchema.parse({ type: "expense", amount: "1 250,50", category: "Їжа" });
    expect(parsed).toMatchObject({ type: "expense", amount: "1250.50", category: "Їжа" });
  });

  it("accepts a signed flip and a negative balance correction", () => {
    expect(agentOperationSchema.parse({ type: "flip", pnl: "-12", setup: "Buff → TM" })).toMatchObject({ pnl: "-12" });
    expect(agentOperationSchema.parse({ type: "set_balance", account: "Мейн картка", balance: -5 })).toMatchObject({ balance: "-5" });
  });

  it("refuses zero or negative amounts", () => {
    expect(agentOperationSchema.safeParse({ type: "expense", amount: "0", category: "Їжа" }).success).toBe(false);
    expect(agentOperationSchema.safeParse({ type: "income", amount: "-5", source: "Робота" }).success).toBe(false);
  });

  it("checks dates and required names", () => {
    expect(agentOperationSchema.safeParse({ type: "expense", amount: "5", category: "Їжа", date: "2026-02-30" }).success).toBe(false);
    expect(agentOperationSchema.safeParse({ type: "expense", amount: "5", category: "Їжа", date: "2999-01-01" }).success).toBe(false);
    expect(agentOperationSchema.safeParse({ type: "expense", amount: "5" }).success).toBe(false);
    expect(agentOperationSchema.safeParse({ type: "work_expense", amount: "5" }).success).toBe(false);
  });

  it("knows management and delete operations", () => {
    expect(agentOperationSchema.parse({ type: "create_account", name: "Банка", accountType: "OTHER", currency: "uah", isReserved: true })).toMatchObject({ currency: "UAH" });
    expect(agentOperationSchema.parse({ type: "delete", transactionId: "abc", permanent: true })).toMatchObject({ permanent: true });
    expect(agentOperationSchema.safeParse({ type: "create_account", name: "X", accountType: "PIGGY", currency: "UAH" }).success).toBe(false);
    expect(agentOperationSchema.safeParse({ type: "drop_everything" }).success).toBe(false);
  });

  it("knows the Steam record and frozen-entry operations", () => {
    expect(agentOperationSchema.parse({ type: "steam_round_delete", roundId: "r1" })).toMatchObject({ roundId: "r1" });
    expect(agentOperationSchema.parse({ type: "steam_round_delete", roundId: "r1", refund: false })).toMatchObject({ refund: false });
    expect(agentOperationSchema.parse({ type: "steam_withdrawal", steamAccount: "1пп", spent: "100", received: "70" })).toMatchObject({ spent: "100" });
    expect(agentOperationSchema.parse({ type: "expected_update", entry: "мекс індус", status: "LOST" })).toMatchObject({ status: "LOST" });
    expect(agentOperationSchema.safeParse({ type: "expected_update", entry: "мекс індус", status: "GONE" }).success).toBe(false);
    expect(agentOperationSchema.safeParse({ type: "steam_round_delete" }).success).toBe(false);
  });

  it("takes a raw row change as given", () => {
    const parsed = agentOperationSchema.parse({ type: "raw_update", table: "SteamArbitrageRound", id: "r1", data: { note: "дубль", investedAmount: "50" } });
    expect(parsed).toMatchObject({ table: "SteamArbitrageRound", data: { note: "дубль", investedAmount: "50" } });
    expect(agentOperationSchema.safeParse({ type: "raw_update", table: "Flip", id: "f1" }).success).toBe(false);
  });
});
