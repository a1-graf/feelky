import { NextResponse } from "next/server";
import { AccountType, Currency } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ledger } from "@/lib/ledger";
import { accountSchema } from "@/lib/schemas";
import { requireApiUserId } from "@/lib/session";

export async function GET() {
  try {
    const userId = await requireApiUserId();
    const accounts = await prisma.account.findMany({
      where: { userId },
      include: { childAccounts: true },
      orderBy: [{ type: "asc" }, { createdAt: "asc" }]
    });
    return NextResponse.json(accounts);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireApiUserId();
    const input = accountSchema.parse(await request.json());
    const account = await ledger.createAccount(userId, {
      type: input.type as AccountType,
      name: input.name,
      currency: input.currency as Currency,
      provider: input.provider,
      initialBalance: input.initialBalance,
      note: input.note,
      parentAccountId: input.parentAccountId
    });
    return NextResponse.json(account, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Account error" }, { status: 400 });
  }
}
