import { describe, expect, it } from "vitest";
import { claimUpdateId, isDuplicateKeyError, pruneThreshold, shouldPrune } from "@/lib/telegram/dedupe";
import type { UpdateClaimStore } from "@/lib/telegram/dedupe";

/** Mimics the Postgres primary key on TelegramUpdate.updateId. */
function memoryStore() {
  const stored = new Set<string>();
  const store: UpdateClaimStore = {
    async create(updateId: bigint) {
      const key = updateId.toString();
      if (stored.has(key)) {
        const error: Error & { code?: string } = new Error("Unique constraint failed on the fields: (`updateId`)");
        error.code = "P2002";
        throw error;
      }
      stored.add(key);
    }
  };
  return { stored, store };
}

describe("telegram update deduplication", () => {
  it("claims a fresh update once", async () => {
    const { store } = memoryStore();
    await expect(claimUpdateId(1001, store)).resolves.toBe(true);
  });

  it("drops a redelivered update_id", async () => {
    const { store, stored } = memoryStore();
    expect(await claimUpdateId(1001, store)).toBe(true);
    expect(await claimUpdateId(1001, store)).toBe(false);
    expect(await claimUpdateId(1001, store)).toBe(false);
    expect(stored.size).toBe(1);
  });

  it("treats different ids independently", async () => {
    const { store } = memoryStore();
    expect(await claimUpdateId(1, store)).toBe(true);
    expect(await claimUpdateId(2, store)).toBe(true);
    expect(await claimUpdateId(1, store)).toBe(false);
  });

  it("rethrows unexpected storage errors", async () => {
    const store: UpdateClaimStore = {
      async create() {
        throw new Error("connection lost");
      }
    };
    await expect(claimUpdateId(5, store)).rejects.toThrow("connection lost");
  });

  it("recognizes prisma and postgres duplicate codes", () => {
    expect(isDuplicateKeyError({ code: "P2002" })).toBe(true);
    expect(isDuplicateKeyError({ code: "23505" })).toBe(true);
    expect(isDuplicateKeyError({ code: "P2025" })).toBe(false);
    expect(isDuplicateKeyError(null)).toBe(false);
  });

  it("prunes rarely and only old rows", () => {
    expect(shouldPrune(0)).toBe(true);
    expect(shouldPrune(0.9)).toBe(false);
    const now = new Date("2026-08-26T00:00:00.000Z");
    expect(pruneThreshold(now).toISOString()).toBe("2026-08-19T00:00:00.000Z");
  });
});
