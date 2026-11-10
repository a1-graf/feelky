import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { authorizeAgent } from "@/lib/agent";
import { pushMessageSchema, sendPush } from "@/lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Lets the agent send a push to the user's installed app: {title, body?, url?}. */
export async function POST(request: Request) {
  const auth = await authorizeAgent(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const message = pushMessageSchema.parse(await request.json());
    const result = await sendPush(auth.userId, message);
    return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid body", issues: error instanceof ZodError ? error.flatten().fieldErrors : undefined }, { status: 422 });
    }
    console.error("[agent] push failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Push failed" }, { status: 500 });
  }
}
