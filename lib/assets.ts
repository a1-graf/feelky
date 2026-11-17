import { Prisma } from "@prisma/client";
import type { Currency } from "@prisma/client";
import Decimal from "decimal.js";
import { resolveUahUsdtRate } from "@/lib/dashboard";
import { prisma } from "@/lib/db";
import { toUsdt } from "@/lib/debt-math";
import { D, roundCurrency } from "@/lib/money";

/** Property (a car, a laptop): an estimate with its history. It never touches an account, income or expenses. */

export class AssetError extends Error {}

export const ASSET_CATEGORIES = ["Транспорт", "Техніка", "Нерухомість", "Цінні речі", "Інше"] as const;

type CurrencyCode = "UAH" | "USDT" | "USD";

function cleanValue(value: Decimal.Value, currency: Currency) {
  const amount = roundCurrency(value, currency as CurrencyCode);
  if (amount.lt(0)) throw new AssetError("Оцінка не може бути від'ємною");
  return amount;
}

export async function createAsset(userId: string, input: { name: string; category?: string | null; value: Decimal.Value; currency: Currency; valuedAt: Date; note?: string | null }) {
  const name = input.name.trim();
  if (!name) throw new AssetError("Вкажи назву");
  const value = cleanValue(input.value, input.currency);
  return prisma.$transaction(async (tx) => {
    const asset = await tx.asset.create({
      data: { userId, name, category: input.category?.trim() || "Інше", value: value.toString(), currency: input.currency, valuedAt: input.valuedAt, note: input.note?.trim() || null }
    });
    await tx.assetValuation.create({ data: { userId, assetId: asset.id, value: value.toString(), currency: input.currency, valuedAt: input.valuedAt, note: "Перша оцінка" } });
    await tx.auditLog.create({ data: { userId, entityType: "Asset", entityId: asset.id, action: "CREATE", newData: asset as unknown as Prisma.InputJsonValue } });
    return asset;
  });
}

/** A new estimate: it becomes the current value (when it is not older than the current one) and joins the history. */
export async function revalueAsset(userId: string, input: { assetId: string; value: Decimal.Value; currency?: Currency | null; valuedAt: Date; note?: string | null }) {
  return prisma.$transaction(async (tx) => {
    const asset = await tx.asset.findFirst({ where: { id: input.assetId, userId, archivedAt: null } });
    if (!asset) throw new AssetError("Річ не знайдено");
    const currency = input.currency ?? asset.currency;
    const value = cleanValue(input.value, currency);
    await tx.assetValuation.create({ data: { userId, assetId: asset.id, value: value.toString(), currency, valuedAt: input.valuedAt, note: input.note?.trim() || null } });
    if (input.valuedAt.getTime() < asset.valuedAt.getTime()) return asset;
    return tx.asset.update({ where: { id: asset.id }, data: { value: value.toString(), currency, valuedAt: input.valuedAt } });
  });
}

export async function updateAsset(userId: string, input: { assetId: string; name?: string | null; category?: string | null; note?: string | null }) {
  const asset = await prisma.asset.findFirst({ where: { id: input.assetId, userId, archivedAt: null } });
  if (!asset) throw new AssetError("Річ не знайдено");
  return prisma.asset.update({
    where: { id: asset.id },
    data: { name: input.name?.trim() || undefined, category: input.category?.trim() || undefined, note: input.note === undefined ? undefined : input.note?.trim() || null }
  });
}

/** Removes a thing from the list (archived with its history, never erased). */
export async function deleteAsset(userId: string, assetId: string) {
  const asset = await prisma.asset.findFirst({ where: { id: assetId, userId, archivedAt: null } });
  if (!asset) throw new AssetError("Річ не знайдено");
  const archived = await prisma.asset.update({ where: { id: asset.id }, data: { archivedAt: new Date() } });
  await prisma.auditLog.create({ data: { userId, entityType: "Asset", entityId: asset.id, action: "DELETE", oldData: asset as unknown as Prisma.InputJsonValue } });
  return archived;
}

export async function findAsset(userId: string, value: string) {
  const assets = await prisma.asset.findMany({ where: { userId, archivedAt: null }, orderBy: { createdAt: "asc" } });
  const byId = assets.find((asset) => asset.id === value);
  if (byId) return byId;
  const target = value.trim().toLowerCase();
  const matches = assets.filter((asset) => asset.name.toLowerCase() === target);
  if (!matches.length) throw new AssetError(`Річ «${value}» не знайдено. Є: ${assets.map((asset) => asset.name).join(", ") || "нічого"}`);
  if (matches.length > 1) throw new AssetError(`Речей «${value}» кілька — передай id: ${matches.map((asset) => asset.id).join(", ")}`);
  return matches[0];
}

export type AssetView = Awaited<ReturnType<typeof listAssets>>["assets"][number];

/** Every active thing with its value in USDT at the site's rate, newest estimates first in the history. */
export async function listAssets(userId: string, rateValue?: Decimal.Value) {
  const [assets, rate] = await Promise.all([
    prisma.asset.findMany({ where: { userId, archivedAt: null }, orderBy: [{ category: "asc" }, { createdAt: "asc" }], include: { valuations: { orderBy: { valuedAt: "desc" }, take: 12 } } }),
    rateValue == null ? resolveUahUsdtRate(userId).then((data) => data.rate) : Promise.resolve(D(rateValue))
  ]);
  const views = assets.map((asset) => ({
    id: asset.id,
    name: asset.name,
    category: asset.category,
    value: asset.value.toString(),
    currency: asset.currency,
    valueUsdt: toUsdt(asset.value.toString(), asset.currency, rate).toString(),
    valuedAt: asset.valuedAt,
    note: asset.note,
    history: asset.valuations.map((item) => ({ id: item.id, value: item.value.toString(), currency: item.currency, valuedAt: item.valuedAt, note: item.note }))
  }));
  const totalUsdt = views.reduce((sum, asset) => sum.plus(asset.valueUsdt), new Decimal(0));
  const byCategory = new Map<string, Decimal>();
  for (const asset of views) byCategory.set(asset.category, (byCategory.get(asset.category) ?? new Decimal(0)).plus(asset.valueUsdt));
  return {
    rate: rate.toString(),
    assets: views,
    totals: {
      totalUsdt: totalUsdt.toString(),
      count: views.length,
      byCategory: Array.from(byCategory, ([name, value]) => ({ name, valueUsdt: value.toString() })).sort((a, b) => Number(b.valueUsdt) - Number(a.valueUsdt))
    }
  };
}
