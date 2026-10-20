import { TransactionType } from "@prisma/client";
import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { agentOperationSchema } from "@/lib/agent-operations";
import { p2pDepositCalculation } from "@/lib/calculations";
import { LedgerService } from "@/lib/ledger";
import { p2pDepositSchema } from "@/lib/schemas";
import { parseP2PDepositEntry } from "@/lib/telegram/parse";

type EffectInput = {
  type: TransactionType;
  amount: string;
  convertedAmount: Decimal | null;
  sourceAccountId: string | null;
  destinationAccountId: string | null;
};

/** The balance effect is what archive, undo and restore reverse, so it is checked directly. */
const effectForAccount = (transaction: EffectInput, accountId: string) =>
  (new LedgerService() as unknown as { effectForAccount(t: EffectInput, id: string): Decimal }).effectForAccount(transaction, accountId);

describe("P2P deposit", () => {
  it("turns paid UAH into USDT at the rate", () => {
    const result = p2pDepositCalculation("5000", "41.6");
    expect(result.spentUah.toString()).toBe("5000");
    expect(result.receivedUsdt.toString()).toBe("120.1923");
  });

  it("parses the same one-line format as a withdrawal", () => {
    expect(parseP2PDepositEntry("5000 41.6 Binance")).toEqual({ spentUah: "5000", rateUahPerUsdt: "41.6", note: "Binance" });
    expect(parseP2PDepositEntry("10 000 41,6")).toEqual({ spentUah: "10000", rateUahPerUsdt: "41.6", note: null });
    expect(parseP2PDepositEntry("5000")).toBeNull();
  });

  it("takes UAH off the card and puts USDT on the wallet", () => {
    const deposit = {
      type: TransactionType.P2P_DEPOSIT,
      amount: "5000",
      convertedAmount: new Decimal("120.1923"),
      sourceAccountId: "card",
      destinationAccountId: "wallet"
    };
    expect(effectForAccount(deposit, "card").toString()).toBe("-5000");
    expect(effectForAccount(deposit, "wallet").toString()).toBe("120.1923");
  });

  it("accepts the site form and the agent operation", () => {
    expect(p2pDepositSchema.parse({ spentUah: "1 234,56", rateUahPerUsdt: "41,6", transactionDate: "2026-10-20" })).toMatchObject({ spentUah: 1234.56, rateUahPerUsdt: 41.6 });
    expect(agentOperationSchema.parse({ type: "p2p_deposit", spentUah: "5000", rate: "41.6" })).toMatchObject({ spentUah: "5000", rate: "41.6" });
    expect(agentOperationSchema.safeParse({ type: "p2p_deposit", spentUah: "0", rate: "41.6" }).success).toBe(false);
  });
});
