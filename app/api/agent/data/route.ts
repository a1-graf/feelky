import { NextResponse } from "next/server";
import { authorizeAgent } from "@/lib/agent";
import { agentRefusal } from "@/lib/agent-operations";
import { RAW_TABLES, rawList } from "@/lib/agent-raw";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Rows of any of the user's tables, newest first. Without `table` it lists the tables. */
export async function GET(request: Request) {
  const auth = await authorizeAgent(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const params = new URL(request.url).searchParams;
  const table = params.get("table");
  if (!table) return NextResponse.json({ tables: RAW_TABLES }, { headers: { "Cache-Control": "no-store" } });
  try {
    const limit = Number(params.get("limit") || 50);
    const rows = await rawList(auth.userId, { table, id: params.get("id"), limit: Number.isFinite(limit) ? limit : 50 });
    return NextResponse.json({ table, count: rows.length, rows }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const refusal = agentRefusal(error);
    if (refusal) return NextResponse.json({ error: refusal.message }, { status: refusal.status });
    console.error("[agent] data list failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Data list failed" }, { status: 500 });
  }
}
