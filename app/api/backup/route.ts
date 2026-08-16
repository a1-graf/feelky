import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiUserId } from "@/lib/session";
import { apiError } from "@/lib/api-error";

export async function GET() {
  try {
    const userId = await requireApiUserId();
    const [user, accounts, categories, incomeSources, transactions, frozenFunds, expectedMoney, settings] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true, createdAt: true } }),
      prisma.account.findMany({ where: { userId } }),
      prisma.category.findMany({ where: { userId } }),
      prisma.incomeSource.findMany({ where: { userId } }),
      prisma.transaction.findMany({ where: { userId } }),
      prisma.frozenFund.findMany({ where: { userId } }),
      prisma.expectedMoney.findMany({ where: { userId } }),
      prisma.settings.findUnique({ where: { userId } })
    ]);
    return NextResponse.json({ exportedAt: new Date().toISOString(), user, accounts, categories, incomeSources, transactions, frozenFunds, expectedMoney, settings });
  } catch (error) {
    return apiError(error, "Backup error");
  }
}
