"use server";

import { revalidatePath } from "next/cache";
import { steamArbitrage, steamResale } from "@/lib/steam";
import { requireUserId } from "@/lib/session";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function required(formData: FormData, key: string) {
  const value = text(formData, key);
  if (!value) throw new Error(`${key} is required`);
  return value;
}

function dateValue(formData: FormData, key: string) {
  const value = text(formData, key);
  return value ? new Date(value) : new Date();
}

export async function createSteamResaleAccountAction(formData: FormData) {
  const userId = await requireUserId();
  await steamResale.createAccount(userId, {
    name: required(formData, "name"),
    note: text(formData, "note"),
    currentSoftwareBalance: text(formData, "currentSoftwareBalance") || "0"
  });
  revalidatePath("/steam");
}

export async function createSteamResaleInvestmentAction(formData: FormData) {
  const userId = await requireUserId();
  await steamResale.createInvestment(userId, {
    resaleAccountId: required(formData, "resaleAccountId"),
    sourceAccountId: required(formData, "sourceAccountId"),
    externalAmount: required(formData, "externalAmount"),
    receivedSteamAmount: text(formData, "receivedSteamAmount") || "0",
    startedAt: dateValue(formData, "startedAt"),
    completedAt: text(formData, "completedAt") ? dateValue(formData, "completedAt") : null,
    note: text(formData, "note")
  });
  revalidatePath("/steam");
  revalidatePath("/statistics");
}

export async function updateSteamResaleInvestmentReceivedAction(formData: FormData) {
  const userId = await requireUserId();
  await steamResale.updateInvestmentReceived(userId, {
    investmentId: required(formData, "investmentId"),
    receivedSteamAmount: required(formData, "receivedSteamAmount"),
    completedAt: dateValue(formData, "completedAt"),
    note: text(formData, "note")
  });
  revalidatePath("/steam");
  revalidatePath("/statistics");
}

export async function createSteamSnapshotAction(formData: FormData) {
  const userId = await requireUserId();
  await steamResale.createSnapshot(userId, {
    resaleAccountId: required(formData, "resaleAccountId"),
    balance: required(formData, "balance"),
    snapshotDate: dateValue(formData, "snapshotDate"),
    note: text(formData, "note")
  });
  revalidatePath("/steam");
}

export async function createSteamResaleWithdrawalAction(formData: FormData) {
  const userId = await requireUserId();
  await steamResale.createWithdrawal(userId, {
    resaleAccountId: required(formData, "resaleAccountId"),
    destinationAccountId: required(formData, "destinationAccountId"),
    softwareAmountSpent: required(formData, "softwareAmountSpent"),
    amountReceived: required(formData, "amountReceived"),
    withdrawalDate: dateValue(formData, "withdrawalDate"),
    note: text(formData, "note")
  });
  revalidatePath("/steam");
  revalidatePath("/statistics");
}

export async function createSteamSchemeAction(formData: FormData) {
  const userId = await requireUserId();
  await steamArbitrage.createScheme(userId, { name: required(formData, "name") });
  revalidatePath("/steam");
}

export async function createSteamRoundAction(formData: FormData) {
  const userId = await requireUserId();
  await steamArbitrage.createRound(userId, {
    schemeId: required(formData, "schemeId"),
    siteName: text(formData, "siteName"),
    sourceAccountId: required(formData, "sourceAccountId"),
    investedAmount: required(formData, "investedAmount"),
    startedAt: dateValue(formData, "startedAt"),
    note: text(formData, "note")
  });
  revalidatePath("/steam");
  revalidatePath("/statistics");
}

export async function completeSteamRoundAction(formData: FormData) {
  const userId = await requireUserId();
  await steamArbitrage.completeRound(userId, {
    roundId: required(formData, "roundId"),
    destinationAccountId: required(formData, "destinationAccountId"),
    finalAmountReceived: required(formData, "finalAmountReceived"),
    remainingAmount: text(formData, "remainingAmount") || "0",
    completedAt: dateValue(formData, "completedAt"),
    note: text(formData, "note")
  });
  revalidatePath("/steam");
  revalidatePath("/statistics");
}
