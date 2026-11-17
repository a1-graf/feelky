"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/components/action-form";
import { AssetError, createAsset, deleteAsset, revalueAsset, updateAsset } from "@/lib/assets";
import { formatMoney } from "@/lib/money";
import { requireUserId } from "@/lib/session";
import { isValidDateKey, resolveTransactionDate } from "@/lib/telegram/dates";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function amount(formData: FormData, key: string) {
  const value = text(formData, key)?.replace(/\s/g, "").replace(",", ".");
  if (!value) throw new AssetError("Вкажи оцінку");
  if (!/^\d+(\.\d+)?$/.test(value)) throw new AssetError("Оцінка — це число, напр. 150 000,00");
  return value;
}

function currency(formData: FormData) {
  return (["UAH", "USDT", "USD"] as const).find((code) => code === text(formData, "currency")) ?? null;
}

function date(formData: FormData) {
  const value = text(formData, "date");
  return resolveTransactionDate(value && isValidDateKey(value) ? value : null);
}

async function run(work: () => Promise<string>): Promise<ActionResult> {
  try {
    const message = await work();
    revalidatePath("/assets");
    revalidatePath("/overview");
    return { ok: true, message };
  } catch (error) {
    if (error instanceof AssetError) return { ok: false, message: error.message };
    console.error("[assets] action failed", error instanceof Error ? error.message : error);
    return { ok: false, message: "Не вдалося зберегти. Спробуй ще раз." };
  }
}

export async function createAssetAction(formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const userId = await requireUserId();
    const asset = await createAsset(userId, {
      name: text(formData, "name") ?? "",
      category: text(formData, "category"),
      value: amount(formData, "value"),
      currency: currency(formData) ?? "USD",
      valuedAt: date(formData),
      note: text(formData, "note")
    });
    return `«${asset.name}» додано: ${formatMoney(asset.value.toString(), asset.currency)}`;
  });
}

export async function revalueAssetAction(formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const userId = await requireUserId();
    const assetId = text(formData, "assetId");
    if (!assetId) throw new AssetError("Річ не знайдено");
    const asset = await revalueAsset(userId, { assetId, value: amount(formData, "value"), currency: currency(formData), valuedAt: date(formData), note: text(formData, "note") });
    return `Нову оцінку записано, зараз ${formatMoney(asset.value.toString(), asset.currency)}`;
  });
}

export async function updateAssetAction(formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const userId = await requireUserId();
    const assetId = text(formData, "assetId");
    if (!assetId) throw new AssetError("Річ не знайдено");
    const asset = await updateAsset(userId, { assetId, name: text(formData, "name"), category: text(formData, "category"), note: text(formData, "note") });
    return `«${asset.name}» збережено`;
  });
}

export async function deleteAssetAction(formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const userId = await requireUserId();
    const assetId = text(formData, "assetId");
    if (!assetId) throw new AssetError("Річ не знайдено");
    const asset = await deleteAsset(userId, assetId);
    return `«${asset.name}» прибрано зі списку`;
  });
}
