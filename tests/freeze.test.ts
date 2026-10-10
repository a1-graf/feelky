import { TransactionType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { frozenMoveOf } from "@/lib/ledger";

describe("freeze into Заморожені бабки", () => {
  it("recognises both legs of a freeze that moved money", () => {
    const metadata = { expectedMoneyId: "exp-1", movesBalance: true };
    expect(frozenMoveOf({ type: TransactionType.FUNDS_FROZEN, metadata })).toEqual({ expectedMoneyId: "exp-1" });
    expect(frozenMoveOf({ type: TransactionType.FUNDS_RELEASED, metadata })).toEqual({ expectedMoneyId: "exp-1" });
  });

  it("leaves the old per-account freeze marker and other types alone", () => {
    expect(frozenMoveOf({ type: TransactionType.FUNDS_FROZEN, metadata: { frozenFundId: "f-1" } })).toBeNull();
    expect(frozenMoveOf({ type: TransactionType.TRANSFER, metadata: { expectedMoneyId: "exp-1", movesBalance: true } })).toBeNull();
    expect(frozenMoveOf({ type: TransactionType.FUNDS_FROZEN, metadata: null })).toBeNull();
  });
});
