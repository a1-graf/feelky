import { NextResponse } from "next/server";
import { AccountType, Currency } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ledger } from "@/lib/ledger";
import { accountSchema } from "@/lib/schemas";
import { requireApiUserId } from "@/lib/session";
import { apiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const userId = await requireApiUserId();
    const accounts = await prisma.account.findMany({
      where: { userId },
      include: { childAccounts: true },
      orderBy: [{ type: "asc" }, { createdAt: "asc" }]
    });
    return NextResponse.json(accounts);
  } catch (error) {
    return apiError(error, "Accounts error");
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
    return apiError(error, "Account error");
  }
}
