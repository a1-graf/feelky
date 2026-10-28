import { NextResponse } from "next/server";
import { authorizeAgent } from "@/lib/agent";
import { getForksSummary } from "@/lib/forks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Fork statistics computed by the same code as the /forks page. Read-only. */
export async function GET(request: Request) {
  const auth = await authorizeAgent(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    return NextResponse.json(await getForksSummary(auth.userId), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[agent] forks summary failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Forks summary failed" }, { status: 500 });
  }
}
