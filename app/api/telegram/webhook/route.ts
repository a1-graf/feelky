import { NextResponse } from "next/server";
import { isTelegramConfigured, readTelegramConfig } from "@/lib/telegram/config";
import { claimUpdateId, shouldPrune } from "@/lib/telegram/dedupe";
import { handleTelegramUpdate } from "@/lib/telegram/handlers";
import { isValidSecretToken } from "@/lib/telegram/security";
import { prismaUpdateStore, pruneOldUpdates } from "@/lib/telegram/session";
import { isTelegramUpdatePayload } from "@/lib/telegram/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const OK = { ok: true } as const;

export async function POST(request: Request) {
  const config = readTelegramConfig();
  if (!isTelegramConfigured(config)) {
    console.error("[telegram] webhook hit but the bot env is incomplete");
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  if (!isValidSecretToken(request.headers.get("x-telegram-bot-api-secret-token"), config.webhookSecret)) {
    console.warn("[telegram] webhook rejected: invalid secret token");
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(OK);
  }
  if (!isTelegramUpdatePayload(payload)) return NextResponse.json(OK);

  // Claim first: a redelivered update_id never reaches the handlers, so it can never
  // create a second financial operation.
  try {
    const claimed = await claimUpdateId(payload.update_id, prismaUpdateStore);
    if (!claimed) {
      console.warn(`[telegram] duplicate update ${payload.update_id} ignored`);
      return NextResponse.json({ ok: true, duplicate: true });
    }
  } catch (error) {
    console.error("[telegram] could not claim update id", error instanceof Error ? error.message : error);
    // Nothing was written yet, so letting Telegram retry is safe.
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  try {
    await handleTelegramUpdate(payload, config);
  } catch (error) {
    console.error("[telegram] update handling failed", error instanceof Error ? error.message : error);
  }

  if (shouldPrune()) {
    await pruneOldUpdates().catch((error) =>
      console.error("[telegram] update prune failed", error instanceof Error ? error.message : error)
    );
  }

  return NextResponse.json(OK);
}
