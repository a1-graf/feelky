import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { authorizeAgent } from "@/lib/agent";
import { kyivStamp, parseTransactionQuery } from "@/lib/agent-query";
import { deleteFork, listForks, upsertFork } from "@/lib/forks";
import { forkInputSchema } from "@/lib/forks-input";
import { forkPercent } from "@/lib/forks-stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Arbitrage forks (1win <-> Polymarket). A standalone journal: nothing here touches any account or balance. */

type Row = Awaited<ReturnType<typeof listForks>>[number];

function serialize(fork: Row) {
  const text = (value: unknown) => (value == null ? null : String(value));
  return {
    id: fork.id,
    externalId: fork.externalId,
    status: fork.status,
    placedAt: kyivStamp(fork.placedAt),
    sport: fork.sport,
    match: fork.match,
    tags: fork.tags,
    legs: [
      { book: fork.leg1Book, pick: fork.leg1Pick, odds: text(fork.leg1Odds), stake: text(fork.leg1Stake) },
      { book: fork.leg2Book, pick: fork.leg2Pick, odds: text(fork.leg2Odds), stake: text(fork.leg2Stake) }
    ],
    total: text(fork.total),
    pnl: text(fork.pnl),
    percent: forkPercent(fork)?.toDecimalPlaces(2).toString() ?? null,
    guaranteed: text(fork.guaranteed),
    note: fork.note
  };
}

export async function GET(request: Request) {
  const auth = await authorizeAgent(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const query = parseTransactionQuery(new URL(request.url).searchParams);
    const forks = await listForks(auth.userId, query);
    return NextResponse.json(
      { period: { from: kyivStamp(query.from), to: kyivStamp(query.to) }, count: forks.length, forks: forks.map(serialize) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[agent] forks list failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Forks list failed" }, { status: 500 });
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
    const input = forkInputSchema.parse(body);
    const { fork, duplicate, updated } = await upsertFork(auth.userId, input);
    return NextResponse.json({ duplicate, updated, fork: serialize(fork) }, { status: duplicate || updated ? 200 : 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid fork", issues: error.flatten().fieldErrors }, { status: 422 });
    }
    console.error("[agent] fork create failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Fork create failed" }, { status: 500 });
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
    const result = await deleteFork(auth.userId, { id, externalId });
    if (result.status === "missing") return NextResponse.json({ deleted: false, error: "Fork not found" }, { status: 404 });
    return NextResponse.json({ deleted: true, fork: serialize(result.fork) });
  } catch (error) {
    console.error("[agent] fork delete failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Fork delete failed" }, { status: 500 });
  }
}
