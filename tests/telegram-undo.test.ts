import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { decodeUndoRef, encodeUndoRef, performUndo, undoMessage } from "@/lib/telegram/undo";
import type { UndoGateway, UndoOutcome } from "@/lib/telegram/undo";

const USER = "user-1";

/**
 * Mirrors the ledger contract: archiving a transaction reverses its balance effect exactly once,
 * a second archive is a no-op. The same guarantee is what LedgerService.archiveTransaction gives.
 */
function memoryGateway(startBalance: string) {
  const state = {
    balance: new Decimal(startBalance),
    transactions: new Map<string, { amount: string; archived: boolean }>(),
    flips: new Map<string, { pnl: string }>(),
    expected: new Set<string>(),
    archiveCalls: 0
  };

  const gateway: UndoGateway = {
    async archiveTransaction(_userId: string, transactionId: string): Promise<UndoOutcome> {
      state.archiveCalls += 1;
      const transaction = state.transactions.get(transactionId);
      if (!transaction) return "missing";
      if (transaction.archived) return "already";
      transaction.archived = true;
      // The stored transaction is an expense, so reversing it credits the account back.
      state.balance = state.balance.plus(transaction.amount);
      return "undone";
    },
    async undoFlip(_userId: string, flipId: string): Promise<UndoOutcome> {
      const flip = state.flips.get(flipId);
      if (!flip) return "already";
      state.flips.delete(flipId);
      state.balance = state.balance.minus(flip.pnl);
      return "undone";
    },
    async removeExpectedMoney(_userId: string, expectedId: string): Promise<UndoOutcome> {
      if (!state.expected.has(expectedId)) return "already";
      state.expected.delete(expectedId);
      return "undone";
    }
  };

  return { state, gateway };
}

describe("undo callback payloads", () => {
  it("round-trips every kind", () => {
    for (const kind of ["tx", "flip", "expected"] as const) {
      const data = encodeUndoRef({ kind, id: "abc123" });
      expect(decodeUndoRef(data)).toEqual({ kind, id: "abc123" });
    }
  });

  it("rejects foreign or malformed payloads", () => {
    expect(decodeUndoRef("m:expense")).toBeNull();
    expect(decodeUndoRef("u:tx")).toBeNull();
    expect(decodeUndoRef("u:unknown:abc")).toBeNull();
    expect(decodeUndoRef("u:tx:")).toBeNull();
    expect(decodeUndoRef("u:tx:../../etc")).toBeNull();
    expect(decodeUndoRef(`u:tx:${"x".repeat(41)}`)).toBeNull();
  });
});

describe("undo of a transaction", () => {
  it("reverses the balance exactly once when pressed twice", async () => {
    const { state, gateway } = memoryGateway("1000");
    state.transactions.set("tx-1", { amount: "250", archived: false });

    const first = await performUndo(USER, { kind: "tx", id: "tx-1" }, gateway);
    expect(first).toBe("undone");
    expect(state.balance.toString()).toBe("1250");

    const second = await performUndo(USER, { kind: "tx", id: "tx-1" }, gateway);
    expect(second).toBe("already");
    expect(state.balance.toString()).toBe("1250");

    const third = await performUndo(USER, { kind: "tx", id: "tx-1" }, gateway);
    expect(third).toBe("already");
    expect(state.balance.toString()).toBe("1250");
    expect(state.archiveCalls).toBe(3);
  });

  it("reports a missing transaction instead of touching balances", async () => {
    const { state, gateway } = memoryGateway("1000");
    expect(await performUndo(USER, { kind: "tx", id: "nope" }, gateway)).toBe("missing");
    expect(state.balance.toString()).toBe("1000");
  });
});

describe("undo of a flip", () => {
  it("removes a positive PnL only once", async () => {
    const { state, gateway } = memoryGateway("1000");
    state.flips.set("flip-1", { pnl: "35.5" });
    expect(await performUndo(USER, { kind: "flip", id: "flip-1" }, gateway)).toBe("undone");
    expect(state.balance.toString()).toBe("964.5");
    expect(await performUndo(USER, { kind: "flip", id: "flip-1" }, gateway)).toBe("already");
    expect(state.balance.toString()).toBe("964.5");
  });

  it("restores a negative PnL only once", async () => {
    const { state, gateway } = memoryGateway("1000");
    state.flips.set("flip-2", { pnl: "-12" });
    expect(await performUndo(USER, { kind: "flip", id: "flip-2" }, gateway)).toBe("undone");
    expect(state.balance.toString()).toBe("1012");
    expect(await performUndo(USER, { kind: "flip", id: "flip-2" }, gateway)).toBe("already");
    expect(state.balance.toString()).toBe("1012");
  });
});

describe("undo of expected money", () => {
  it("deletes the record once", async () => {
    const { state, gateway } = memoryGateway("0");
    state.expected.add("exp-1");
    expect(await performUndo(USER, { kind: "expected", id: "exp-1" }, gateway)).toBe("undone");
    expect(await performUndo(USER, { kind: "expected", id: "exp-1" }, gateway)).toBe("already");
    expect(state.expected.size).toBe(0);
  });
});

describe("undo messages", () => {
  it("tells the user what happened", () => {
    expect(undoMessage("undone")).toContain("скасовано");
    expect(undoMessage("already")).toContain("вже");
    expect(undoMessage("missing")).toContain("не знайдено");
    expect(undoMessage("failed")).toContain("Не вдалося");
  });
});
