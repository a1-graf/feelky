import { NextResponse } from "next/server";
import { Currency, ExpectedMoneyStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ledger } from "@/lib/ledger";
import { expectedMoneySchema } from "@/lib/schemas";
import { requireApiUserId } from "@/lib/session";

export async function GET() {
  try {
    const userId = await requireApiUserId();
    return NextResponse.json(await prisma.expectedMoney.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }));
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireApiUserId();
    const body = await request.json();
    if (body.action === "receive") {
      return NextResponse.json(await ledger.receiveExpectedMoney(userId, body));
    }
    const input = expectedMoneySchema.parse(body);
    return NextResponse.json(await ledger.createExpectedMoney(userId, {
      ...input,
      currency: input.currency as Currency,
      status: input.status as ExpectedMoneyStatus
    }), { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Frozen money error" }, { status: 400 });
  }
}
