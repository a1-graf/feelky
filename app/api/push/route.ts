import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { pushMessageSchema, removeSubscription, saveSubscription, sendPush, subscriptionSchema, vapidKeys } from "@/lib/push";
import { requireApiUserId } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** The public VAPID key the browser needs to subscribe. */
export async function GET() {
  try {
    await requireApiUserId();
    const { publicKey } = await vapidKeys();
    return NextResponse.json({ publicKey }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error, "Push key error");
  }
}

const postSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("subscribe"), subscription: subscriptionSchema }),
  z.object({ action: z.literal("unsubscribe"), endpoint: z.string().url().max(2048) }),
  z.object({ action: z.literal("test") })
]);

export async function POST(request: Request) {
  try {
    const userId = await requireApiUserId();
    const body = postSchema.parse(await request.json());
    if (body.action === "subscribe") {
      await saveSubscription(userId, body.subscription, request.headers.get("user-agent"));
      return NextResponse.json({ ok: true });
    }
    if (body.action === "unsubscribe") {
      return NextResponse.json({ ok: true, removed: await removeSubscription(userId, body.endpoint) });
    }
    const result = await sendPush(userId, pushMessageSchema.parse({ title: "Feelky", body: "Тестове сповіщення: усе працює.", url: "/settings" }));
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return apiError(error, "Push error");
  }
}
