import { NextResponse } from "next/server";
import { authorizeAgent } from "@/lib/agent";
import { getPolyOverview } from "@/lib/poly";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Polymarket statistics computed by the same code as the /poly page. Read-only. */
export async function GET(request: Request) {
  const auth = await authorizeAgent(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const overview = await getPolyOverview(auth.userId);
    const strip = <T extends { timeline: unknown[] }>({ timeline, ...rest }: T) => ({ ...rest, days: timeline.length });
    return NextResponse.json(
      {
        pool: overview.pool,
        locks: overview.locks,
        releasedResult: overview.releasedResult,
        reconcile: overview.reconcile,
        ...strip(overview.all),
        sections: Object.fromEntries(Object.entries(overview.sections).map(([key, value]) => [key, strip(value)]))
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[agent] poly summary failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Poly summary failed" }, { status: 500 });
  }
}
