import { NextResponse } from "next/server";
import { Currency } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ledger } from "@/lib/ledger";
import { freezeFundsSchema } from "@/lib/schemas";
import { requireApiUserId } from "@/lib/session";

export async function GET() {
  try {
    const userId = await requireApiUserId();
    return NextResponse.json(await prisma.frozenFund.findMany({ where: { userId }, include: { account: true }, orderBy: { createdAt: "desc" } }));
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireApiUserId();
    const body = await request.json();
    if (body.action === "release") {
      return NextResponse.json(await ledger.releaseFunds(userId, body.frozenFundId));
    }
    const input = freezeFundsSchema.parse(body);
    return NextResponse.json(await ledger.freezeFunds(userId, { ...input, currency: input.currency as Currency }), { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Frozen funds error" }, { status: 400 });
  }
}
