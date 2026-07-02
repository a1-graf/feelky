import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { flipSchema } from "@/lib/schemas";
import { requireApiUserId } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const userId = await requireApiUserId();
    const input = flipSchema.parse(await request.json());
    const flip = await prisma.flip.create({
      data: {
        userId,
        setup: input.setup,
        pnl: input.pnl,
        tradeDate: input.tradeDate,
        note: input.note
      }
    });
    return NextResponse.json(flip, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Flip error" }, { status: 400 });
  }
}
