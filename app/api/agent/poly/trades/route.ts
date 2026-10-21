import { NextResponse } from "next/server";
import { authorizeAgent } from "@/lib/agent";
import { kyivStamp, parseTransactionQuery } from "@/lib/agent-query";
import { deletePolyTrade, listPolyTrades, upsertPolyTrades } from "@/lib/poly";
import type { PolyTradeInput } from "@/lib/poly";
import { MAX_POLY_BATCH, polyTradeInputSchema } from "@/lib/poly-input";
import type { PolySectionKey } from "@/lib/poly-stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * The only place an agent writes Polymarket trades. One trade or an array of up to 200:
 * every item is saved by externalId, so re-sending a batch never duplicates anything.
 */

function serialize(trade: {
  id: string; externalId: string; section: string; agentName: string | null; walletRef: string | null; marketSlug: string; title: string;
  marketKind: string; outcome: string; entryPrice: unknown; sizeUsd: unknown; shares: unknown; feesUsd: unknown; status: string; pnlUsd: unknown;
  openedAt: Date; resolvedAt: Date | null; signalPrice: unknown; note: string | null;
}) {
  const text = (value: unknown) => (value == null ? null : String(value));
  return {
    id: trade.id,
    externalId: trade.externalId,
    section: trade.section,
    agentName: trade.agentName,
    walletRef: trade.walletRef,
    marketSlug: trade.marketSlug,
    title: trade.title,
    marketKind: trade.marketKind,
    outcome: trade.outcome,
    entryPrice: text(trade.entryPrice),
    sizeUsd: text(trade.sizeUsd),
    shares: text(trade.shares),
    feesUsd: text(trade.feesUsd),
    status: trade.status,
    pnlUsd: text(trade.pnlUsd),
    openedAt: kyivStamp(trade.openedAt),
    resolvedAt: trade.resolvedAt ? kyivStamp(trade.resolvedAt) : null,
    signalPrice: text(trade.signalPrice),
    note: trade.note
  };
}

export async function GET(request: Request) {
  const auth = await authorizeAgent(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const params = new URL(request.url).searchParams;
    const query = parseTransactionQuery(params);
    const section = params.get("section")?.trim().toUpperCase();
    if (section && !["MANUAL", "COPYTRADE", "AI_AGENT"].includes(section)) {
      return NextResponse.json({ error: "section: MANUAL, COPYTRADE or AI_AGENT" }, { status: 400 });
    }
    const trades = await listPolyTrades(auth.userId, {
      ...query,
      section: (section as PolySectionKey | undefined) || undefined,
      agentName: params.get("agent")?.trim() || undefined
    });
    return NextResponse.json(
      { period: { from: kyivStamp(query.from), to: kyivStamp(query.to) }, count: trades.length, trades: trades.map(serialize) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[agent] poly list failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Poly list failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await authorizeAgent(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }
  const single = !Array.isArray(body);
  const items: unknown[] = Array.isArray(body) ? body : [body];
  if (!items.length) return NextResponse.json({ error: "Порожній масив" }, { status: 422 });
  if (items.length > MAX_POLY_BATCH) return NextResponse.json({ error: `Не більше ${MAX_POLY_BATCH} угод за раз` }, { status: 422 });
  try {
    const parsed = items.map((item) => {
      const result = polyTradeInputSchema.safeParse(item);
      if (result.success) return { ok: true as const, input: result.data as PolyTradeInput };
      const externalId = item && typeof item === "object" && typeof (item as Record<string, unknown>).externalId === "string" ? String((item as Record<string, unknown>).externalId) : null;
      const fields = result.error.flatten().fieldErrors;
      return { ok: false as const, externalId, error: Object.entries(fields).map(([key, messages]) => `${key}: ${(messages ?? []).join(", ")}`).join("; ") || "Invalid trade" };
    });
    if (single && !parsed[0].ok) {
      return NextResponse.json({ error: "Invalid trade", message: parsed[0].error }, { status: 422 });
    }
    const batch = await upsertPolyTrades(auth.userId, parsed);
    const status = batch.failed && batch.failed === items.length ? 422 : batch.created && !batch.failed ? 201 : 200;
    return NextResponse.json(batch, { status });
  } catch (error) {
    console.error("[agent] poly create failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Poly create failed" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await authorizeAgent(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const params = new URL(request.url).searchParams;
  const id = params.get("id");
  const externalId = params.get("externalId");
  if (!id && !externalId) return NextResponse.json({ error: "Pass id or externalId" }, { status: 400 });
  try {
    const result = await deletePolyTrade(auth.userId, { id, externalId });
    if (result.status === "missing") return NextResponse.json({ deleted: false, error: "Trade not found" }, { status: 404 });
    return NextResponse.json({ deleted: true, trade: serialize(result.trade) });
  } catch (error) {
    console.error("[agent] poly delete failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Poly delete failed" }, { status: 500 });
  }
}
