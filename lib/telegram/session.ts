import { Prisma } from "@prisma/client";
import type { TelegramSession } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { UpdateClaimStore } from "@/lib/telegram/dedupe";
import { pruneThreshold } from "@/lib/telegram/dedupe";
import type { TelegramCurrency } from "@/lib/telegram/parse";

export type FlowAction =
  | "expense"
  | "income"
  | "work"
  | "savings"
  | "p2p"
  | "cash"
  | "expected"
  | "flip"
  | "manual";

export type FlowStep = "amount" | "account" | "category" | "source" | "setup" | "note" | "input" | "balance";

export type Draft = {
  amount?: string;
  currency?: TelegramCurrency;
  accountId?: string;
  categoryId?: string;
  incomeSourceId?: string;
  /** Flip setup picked from the buttons. */
  setup?: string;
  note?: string | null;
  /** Ids rendered in the current option keyboard - the buttons only carry their index. */
  options?: string[];
  /** Step to come back to after the user changes the account mid-flow. */
  returnStep?: FlowStep;
};

export const prismaUpdateStore: UpdateClaimStore = {
  async create(updateId: bigint) {
    // ON CONFLICT DO NOTHING: a redelivered update is expected traffic, not something
    // worth an error-level Prisma log on every retry.
    const inserted = await prisma.telegramUpdate.createMany({ data: [{ updateId }], skipDuplicates: true });
    if (inserted.count === 0) {
      const duplicate: Error & { code?: string } = new Error("Telegram update already claimed");
      duplicate.code = "P2002";
      throw duplicate;
    }
  },
  async prune(olderThan: Date) {
    await prisma.telegramUpdate.deleteMany({ where: { createdAt: { lt: olderThan } } });
  }
};

export async function pruneOldUpdates(now = new Date()) {
  await prismaUpdateStore.prune?.(pruneThreshold(now));
}

export async function loadTelegramSession(userId: string, telegramUserId: number, chatId: number): Promise<TelegramSession> {
  const key = BigInt(telegramUserId);
  return prisma.telegramSession.upsert({
    where: { telegramUserId: key },
    update: { chatId: BigInt(chatId), userId },
    create: { telegramUserId: key, chatId: BigInt(chatId), userId }
  });
}

export function readDraft(session: Pick<TelegramSession, "draft">): Draft {
  const draft = session.draft;
  if (!draft || typeof draft !== "object" || Array.isArray(draft)) return {};
  return draft as unknown as Draft;
}

export async function saveFlow(
  telegramUserId: number,
  input: { action: FlowAction | null; step: FlowStep | null; draft: Draft | null }
): Promise<TelegramSession> {
  return prisma.telegramSession.update({
    where: { telegramUserId: BigInt(telegramUserId) },
    data: {
      action: input.action,
      step: input.step,
      draft: input.draft ? (input.draft as unknown as Prisma.InputJsonValue) : Prisma.DbNull
    }
  });
}

export async function clearFlow(telegramUserId: number): Promise<TelegramSession> {
  return saveFlow(telegramUserId, { action: null, step: null, draft: null });
}

export type RememberedSelections = Partial<
  Pick<
    TelegramSession,
    | "lastCategoryId"
    | "lastIncomeSourceId"
    | "lastExpenseAccountId"
    | "lastIncomeAccountUah"
    | "lastIncomeAccountUsdt"
    | "lastIncomeAccountUsd"
  >
>;

export async function rememberSelections(telegramUserId: number, patch: RememberedSelections) {
  if (!Object.keys(patch).length) return;
  await prisma.telegramSession.update({ where: { telegramUserId: BigInt(telegramUserId) }, data: patch });
}

export function incomeAccountPatch(currency: TelegramCurrency, accountId: string): RememberedSelections {
  if (currency === "USDT") return { lastIncomeAccountUsdt: accountId };
  if (currency === "USD") return { lastIncomeAccountUsd: accountId };
  return { lastIncomeAccountUah: accountId };
}

export function readLastIncomeAccount(session: TelegramSession, currency: TelegramCurrency): string | null {
  if (currency === "USDT") return session.lastIncomeAccountUsdt;
  if (currency === "USD") return session.lastIncomeAccountUsd;
  return session.lastIncomeAccountUah;
}
