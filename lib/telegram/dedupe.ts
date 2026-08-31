/**
 * Telegram retries a webhook delivery until it gets a 200, so the same `update_id`
 * can arrive several times. We claim every id in Postgres before doing any work:
 * only the first claim wins, every retry is dropped without touching balances.
 */

export type UpdateClaimStore = {
  create(updateId: bigint): Promise<void>;
  prune?(olderThan: Date): Promise<void>;
};

/** Prisma reports a unique violation as P2002, raw Postgres as 23505. */
export function isDuplicateKeyError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  return code === "P2002" || code === "23505";
}

export async function claimUpdateId(updateId: number | bigint, store: UpdateClaimStore): Promise<boolean> {
  const id = typeof updateId === "bigint" ? updateId : BigInt(Math.trunc(updateId));
  try {
    await store.create(id);
    return true;
  } catch (error) {
    if (isDuplicateKeyError(error)) return false;
    throw error;
  }
}

export const UPDATE_RETENTION_DAYS = 7;
export const PRUNE_PROBABILITY = 0.02;

export function shouldPrune(random = Math.random()): boolean {
  return random < PRUNE_PROBABILITY;
}

export function pruneThreshold(now = new Date()): Date {
  return new Date(now.getTime() - UPDATE_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}
