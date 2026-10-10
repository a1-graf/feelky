import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { authorizeAgent } from "@/lib/agent";
import { agentOperationSchema, agentRefusal, runAgentOperation } from "@/lib/agent-operations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Full write access: one operation per request, `type` says which. */
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
    const input = agentOperationSchema.parse(body);
    const result = await runAgentOperation(auth.userId, input);
    return NextResponse.json({ ok: true, type: input.type, ...result });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid operation", issues: error.flatten().fieldErrors }, { status: 422 });
    }
    const refusal = agentRefusal(error);
    if (refusal) return NextResponse.json({ error: refusal.message }, { status: refusal.status });
    console.error("[agent] operation failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Operation failed" }, { status: 500 });
  }
}
