"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/components/action-form";
import { createDebt, DebtError, deleteDebt, repayDebt } from "@/lib/debts";
import { formatMoney } from "@/lib/money";
import { requireUserId } from "@/lib/session";
import { isValidDateKey, resolveTransactionDate } from "@/lib/telegram/dates";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function amount(formData: FormData, key: string) {
  const value = text(formData, key)?.replace(/\s/g, "").replace(",", ".");
  if (!value) return null;
  if (!/^\d+(\.\d+)?$/.test(value)) throw new DebtError("Сума — це число, напр. 1500,00");
  return value;
}

function date(formData: FormData, key: string) {
  const value = text(formData, key);
  return value && isValidDateKey(value) ? value : null;
}

const money = (value: { toString(): string }, currency: string) => formatMoney(value.toString(), currency);

async function run(work: () => Promise<string>): Promise<ActionResult> {
  try {
    const message = await work();
    revalidatePath("/debts");
    revalidatePath("/overview");
    return { ok: true, message };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    // Ledger refusals are short and meant for the user; anything else stays generic.
    if (error instanceof DebtError || /^Insufficient funds on /.test(message)) {
      return { ok: false, message: message.replace(/^Insufficient funds on (.+)$/, "Недостатньо коштів на «$1»") };
    }
    console.error("[debts] action failed", message);
    return { ok: false, message: "Не вдалося зберегти. Спробуй ще раз." };
  }
}

export async function createDebtAction(formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const userId = await requireUserId();
    const direction = text(formData, "direction") === "LENT" ? "LENT" : "BORROWED";
    const currency = (["UAH", "USDT", "USD"] as const).find((code) => code === text(formData, "currency")) ?? "UAH";
    const value = amount(formData, "amount");
    if (!value) throw new DebtError("Вкажи суму");
    const due = date(formData, "dueDate");
    const debt = await createDebt(userId, {
      direction,
      counterparty: text(formData, "counterparty") ?? "",
      amount: value,
      currency,
      accountId: text(formData, "accountId"),
      startedAt: resolveTransactionDate(date(formData, "date")),
      dueDate: due ? new Date(`${due}T12:00:00.000Z`) : null,
      note: text(formData, "note")
    });
    return direction === "BORROWED" ? `Записано: ви винні «${debt.counterparty}» ${money(debt.amount, debt.currency)}` : `Записано: «${debt.counterparty}» винен вам ${money(debt.amount, debt.currency)}`;
  });
}

export async function repayDebtAction(formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const userId = await requireUserId();
    const debtId = text(formData, "debtId");
    const accountId = text(formData, "accountId");
    if (!debtId || !accountId) throw new DebtError("Обери рахунок");
    const outcome = await repayDebt(userId, { debtId, amount: amount(formData, "amount"), accountId, date: resolveTransactionDate(date(formData, "date")), note: text(formData, "note") });
    return outcome.left.lte(0) ? "Борг повністю закрито" : `Погашення записано, лишилось ${money(outcome.left, outcome.debt.currency)}`;
  });
}

export async function deleteDebtAction(formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const userId = await requireUserId();
    const debtId = text(formData, "debtId");
    if (!debtId) throw new DebtError("Борг не знайдено");
    const outcome = await deleteDebt(userId, debtId);
    return outcome.reversed ? "Борг видалено, баланси рахунків повернуто" : "Борг видалено";
  });
}
