import { NextResponse } from "next/server";
import { agentTransactions, authorizeAgent } from "@/lib/agent";
import { parseTransactionQuery } from "@/lib/agent-query";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Read-only transaction list for an external agent. GET only. */
export async function GET(request: Request) {
  const auth = await authorizeAgent(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const query = parseTransactionQuery(new URL(request.url).searchParams);
    return NextResponse.json(await agentTransactions(auth.userId, query), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[agent] transactions failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Transactions failed" }, { status: 500 });
  }
}
