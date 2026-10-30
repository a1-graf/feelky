import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { authorizeAgent } from "@/lib/agent";
import { kyivStamp } from "@/lib/agent-query";
import { addForkBonus, bonusFigures, deleteForkBonus, listForkBonuses } from "@/lib/forks";
import { forkBonusInputSchema } from "@/lib/forks-input";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Extra income of the fork project (1win bonuses, promos). Signed amounts, 100% ours; touches no account. */

type Row = Awaited<ReturnType<typeof listForkBonuses>>[number];
const serialize = (row: Row) => ({ id: row.id, amount: row.amount.toString(), receivedAt: kyivStamp(row.receivedAt), note: row.note });

export async function GET(request: Request) {
  const auth = await authorizeAgent(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const rows = await listForkBonuses(auth.userId);
    return NextResponse.json({ ...bonusFigures(rows), bonuses: rows.map(serialize) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[agent] fork bonus list failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Bonus list failed" }, { status: 500 });
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
    const row = await addForkBonus(auth.userId, forkBonusInputSchema.parse(body));
    return NextResponse.json({ bonus: serialize(row) }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: "Invalid bonus", issues: error.flatten().fieldErrors }, { status: 422 });
    console.error("[agent] fork bonus create failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Bonus create failed" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await authorizeAgent(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Pass id" }, { status: 400 });
  try {
    const row = await deleteForkBonus(auth.userId, id);
    if (!row) return NextResponse.json({ deleted: false, error: "Bonus not found" }, { status: 404 });
    return NextResponse.json({ deleted: true, bonus: serialize(row) });
  } catch (error) {
    console.error("[agent] fork bonus delete failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Bonus delete failed" }, { status: 500 });
  }
}
