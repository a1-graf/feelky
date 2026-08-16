import { NextResponse } from "next/server";
import { createFlipWithLedger } from "@/lib/flips";
import { flipSchema } from "@/lib/schemas";
import { requireApiUserId } from "@/lib/session";
import { apiError } from "@/lib/api-error";

export async function POST(request: Request) {
  try {
    const userId = await requireApiUserId();
    const input = flipSchema.parse(await request.json());
    const flip = await createFlipWithLedger(userId, input);
    return NextResponse.json(flip, { status: 201 });
  } catch (error) {
    return apiError(error, "Flip error");
  }
}
