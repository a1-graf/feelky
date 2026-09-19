import { NextResponse } from "next/server";
import { agentSummary, authorizeAgent } from "@/lib/agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Read-only snapshot for an external agent. GET only - there is no way to write through here. */
export async function GET(request: Request) {
  const auth = await authorizeAgent(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const month = new URL(request.url).searchParams.get("month");
    const safeMonth = month && /^\d{4}-\d{2}$/.test(month) ? month : null;
    return NextResponse.json(await agentSummary(auth.userId, safeMonth), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[agent] summary failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Summary failed" }, { status: 500 });
  }
}
