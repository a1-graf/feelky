import { NextResponse } from "next/server";
import { authorizeAgent } from "@/lib/agent";
import { getFxStatistics } from "@/lib/fx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** FX statistics computed by the same code as the /fx page. Read-only. */
export async function GET(request: Request) {
  const auth = await authorizeAgent(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const { data, brokers, flows } = await getFxStatistics(auth.userId);
    const { timeline, trades, ...stats } = data;
    return NextResponse.json({ brokers, flows, ...stats, days: timeline.length }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[agent] fx summary failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "FX summary failed" }, { status: 500 });
  }
}
