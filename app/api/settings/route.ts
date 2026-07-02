import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiUserId } from "@/lib/session";

export async function GET() {
  const userId = await requireApiUserId();
  const [settings, categories, incomeSources, accounts, statusLabels] = await Promise.all([
    prisma.settings.findUnique({ where: { userId } }),
    prisma.category.findMany({ where: { userId, isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.incomeSource.findMany({ where: { userId, isActive: true }, orderBy: { createdAt: "asc" } }),
    prisma.account.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.expectedStatusDefinition.findMany({ where: { userId }, orderBy: { sortOrder: "asc" } })
  ]);
  return NextResponse.json({ settings, categories, incomeSources, accounts, statusLabels });
}

export async function PATCH(request: Request) {
  const userId = await requireApiUserId();
  const body = await request.json();
  const settings = await prisma.settings.update({
    where: { userId },
    data: {
      baseDisplayCurrency: body.baseDisplayCurrency,
      rateMode: body.rateMode,
      manualUahUsdtRate: body.manualUahUsdtRate || null,
      monthlyExpenseLimit: body.monthlyExpenseLimit || "40000",
      greenMax: body.monthlyExpenseLimit || "40000",
      yellowMax: body.monthlyExpenseLimit || "40000",
      hideAmounts: body.hideAmounts,
      theme: body.theme === "dark" ? "dark" : "light"
    }
  });
  return NextResponse.json(settings);
}
