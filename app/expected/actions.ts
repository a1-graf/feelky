"use server";

import { revalidatePath } from "next/cache";
import { ledger } from "@/lib/ledger";
import { requireUserId } from "@/lib/session";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function freezeFromAccountAction(formData: FormData) {
  const userId = await requireUserId();
  const accountId = text(formData, "accountId");
  const amount = text(formData, "amount")?.replace(/\s/g, "").replace(",", ".");
  if (!accountId || !amount) throw new Error("Вкажи рахунок і суму");
  await ledger.freezeToExpected(userId, { accountId, amount, title: text(formData, "title") });
  revalidatePath("/expected");
  revalidatePath("/overview");
}
