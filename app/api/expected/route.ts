import { NextResponse } from "next/server";
import { Currency, ExpectedMoneyStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ledger } from "@/lib/ledger";
import { decimalInput, expectedMoneySchema } from "@/lib/schemas";
import { requireApiUserId } from "@/lib/session";
import { MAIN_WALLET_NAME } from "@/lib/user-defaults";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const releaseToMainWalletSchema = z.object({
  action: z.literal("releaseToMainWallet"),
  expectedMoneyId: z.string().min(1),
  actualAmount: decimalInput(z.coerce.number().positive()).optional(),
  note: z.string().optional().nullable()
});

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
    if (body.action === "releaseToMainWallet") {
      const input = releaseToMainWalletSchema.parse(body);
      const expected = await prisma.expectedMoney.findFirst({ where: { id: input.expectedMoneyId, userId } });
      if (!expected) return NextResponse.json({ error: "Frozen money record not found" }, { status: 404 });
      const mainWallet = await prisma.account.findFirst({ where: { userId, name: MAIN_WALLET_NAME, currency: "USDT", isActive: true } });
      if (!mainWallet) return NextResponse.json({ error: "Мейн гаманець не знайдено" }, { status: 400 });
      const actualAmount = input.actualAmount ?? (expected.currency === "USDT" ? Number(expected.amount) : undefined);
      if (!actualAmount) return NextResponse.json({ error: "Вкажи фактичну суму в USDT для мейн гаманця" }, { status: 400 });
      const incomeSourceName = "Повернення заморожених";
      const incomeSource = await prisma.incomeSource.findUnique({ where: { userId_name: { userId, name: incomeSourceName } } })
        || await prisma.incomeSource.create({ data: { userId, name: incomeSourceName } });
      return NextResponse.json(await ledger.receiveExpectedMoney(userId, {
        expectedMoneyId: expected.id,
        actualAmount,
        destinationAccountId: mainWallet.id,
        incomeSourceId: incomeSource.id,
        note: input.note || `Розморожено: ${expected.title}`
      }));
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
