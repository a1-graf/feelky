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
});
