/**
 * Undo for the `Скасувати операцію` button.
 *
 * The gateway is the only part that talks to Postgres, so the idempotency rules live here
 * and stay unit-testable: pressing the button twice must never move a balance twice.
 */

export type UndoKind = "tx" | "flip" | "expected";

export type UndoRef = {
  kind: UndoKind;
  id: string;
};

export type UndoOutcome = "undone" | "already" | "missing" | "failed";

export type UndoGateway = {
  /** Reverses the ledger effect of a transaction. Returns "already" when it was archived before. */
  archiveTransaction(userId: string, transactionId: string): Promise<UndoOutcome>;
  undoFlip(userId: string, flipId: string): Promise<UndoOutcome>;
  removeExpectedMoney(userId: string, expectedMoneyId: string): Promise<UndoOutcome>;
};

const UNDO_PREFIX = "u";

export function encodeUndoRef(ref: UndoRef): string {
  return `${UNDO_PREFIX}:${ref.kind}:${ref.id}`;
}

export function decodeUndoRef(data: string): UndoRef | null {
  const parts = data.split(":");
  if (parts.length !== 3) return null;
  const [prefix, kind, id] = parts;
  if (prefix !== UNDO_PREFIX) return null;
  if (kind !== "tx" && kind !== "flip" && kind !== "expected") return null;
  if (!id || id.length > 40 || !/^[A-Za-z0-9_-]+$/.test(id)) return null;
  return { kind, id };
}

export async function performUndo(userId: string, ref: UndoRef, gateway: UndoGateway): Promise<UndoOutcome> {
  if (ref.kind === "flip") return gateway.undoFlip(userId, ref.id);
  if (ref.kind === "expected") return gateway.removeExpectedMoney(userId, ref.id);
  return gateway.archiveTransaction(userId, ref.id);
}

export function undoMessage(outcome: UndoOutcome): string {
  if (outcome === "undone") return "Операцію скасовано, баланс повернуто.";
  if (outcome === "already") return "Операцію вже скасовано раніше.";
  if (outcome === "missing") return "Операцію не знайдено — можливо, її вже видалено.";
  return "Не вдалося скасувати. Спробуй ще раз.";
}
