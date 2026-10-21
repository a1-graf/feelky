import { NextResponse } from "next/server";
import { AccountType } from "@prisma/client";
import { ZodError } from "zod";
import { authorizeAgent } from "@/lib/agent";
import { kyivStamp, parseTransactionQuery } from "@/lib/agent-query";
import { prisma } from "@/lib/db";
import { createFxTradeWithLedger, deleteFxTradeWithLedger, listFxTrades } from "@/lib/fx";
import { fxTradeInputSchema } from "@/lib/fx-input";
import { ownRiskR, riskInR, tradeR } from "@/lib/fx-stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * The only place an agent can write. It is scoped to FX trades: nothing here can touch
 * income, expenses or any other account than a broker one.
 */

function serialize(trade: {
  id: string; externalId: string | null; instrument: string; side: string; lots: unknown; openPrice: unknown; closePrice: unknown; stopLoss: unknown; riskAmount: unknown;
  openedAt: Date | null; closedAt: Date; pnl: unknown; commission: unknown; swap: unknown; setup: string | null; note: string | null;
}) {
  const text = (value: unknown) => (value == null ? null : String(value));
  return {
    id: trade.id,
    externalId: trade.externalId,
    instrument: trade.instrument,
    side: trade.side,
    lots: text(trade.lots),
    openPrice: text(trade.openPrice),
    closePrice: text(trade.closePrice),
    stopLoss: text(trade.stopLoss),
    riskAmount: text(trade.riskAmount),
    rMultiple: tradeR(String(trade.pnl)),
    riskR: riskInR(text(trade.riskAmount)),
    rOfOwnRisk: ownRiskR(String(trade.pnl), text(trade.riskAmount)),
    openedAt: trade.openedAt ? kyivStamp(trade.openedAt) : null,
    closedAt: kyivStamp(trade.closedAt),
    pnl: text(trade.pnl),
    commission: text(trade.commission),
    swap: text(trade.swap),
    setup: trade.setup,
    note: trade.note
  };
}

export async function GET(request: Request) {
  const auth = await authorizeAgent(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const query = parseTransactionQuery(new URL(request.url).searchParams);
    const trades = await listFxTrades(auth.userId, query);
    return NextResponse.json(
      { period: { from: kyivStamp(query.from), to: kyivStamp(query.to) }, count: trades.length, trades: trades.map(serialize) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[agent] fx list failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "FX list failed" }, { status: 500 });
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
  try {
    const input = fxTradeInputSchema.parse(body);
    let accountId: string | null = null;
    if (input.account) {
      const account = await prisma.account.findFirst({
        where: { userId: auth.userId, isActive: true, type: AccountType.BROKER, name: input.account },
        select: { id: true }
      });
      if (!account) return NextResponse.json({ error: `Рахунок брокера «${input.account}» не знайдено` }, { status: 404 });
      accountId = account.id;
    }
    const { trade, duplicate } = await createFxTradeWithLedger(auth.userId, {
      externalId: input.externalId,
      instrument: input.instrument,
      side: input.side,
      lots: input.lots,
      openPrice: input.openPrice,
      closePrice: input.closePrice,
      stopLoss: input.stopLoss,
      riskAmount: input.riskAmount,
      openedAt: input.openedAt ?? null,
      closedAt: input.closedAt,
      pnl: input.pnl,
      commission: input.commission,
      swap: input.swap,
      setup: input.setup,
      note: input.note,
      accountId
    });
    return NextResponse.json({ duplicate, trade: serialize(trade) }, { status: duplicate ? 200 : 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid trade", issues: error.flatten().fieldErrors }, { status: 422 });
    }
    if (error instanceof Error && error.message === "Рахунок брокера не знайдено") {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("[agent] fx create failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "FX create failed" }, { status: 500 });
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
    const result = await deleteFxTradeWithLedger(auth.userId, { id, externalId });
    if (result.status === "missing") return NextResponse.json({ deleted: false, error: "Trade not found" }, { status: 404 });
    return NextResponse.json({ deleted: true, trade: serialize(result.trade) });
  } catch (error) {
    console.error("[agent] fx delete failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "FX delete failed" }, { status: 500 });
  }
}
