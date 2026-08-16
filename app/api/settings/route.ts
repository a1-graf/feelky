import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUserId } from "@/lib/session";
import { apiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const settingsPatchSchema = z.object({
  baseDisplayCurrency: z.enum(["UAH", "USDT", "USD"]).optional(),
  rateMode: z.enum(["AUTO", "P2P_AVERAGE", "MANUAL"]).optional(),
  manualUahUsdtRate: z.union([z.string(), z.number()]).optional().nullable(),
  monthlyExpenseLimit: z.union([z.string(), z.number()]).optional(),
  hideAmounts: z.boolean().optional(),
  theme: z.enum(["dark", "light"]).optional()
});

export async function GET() {
  try {
    const userId = await requireApiUserId();
    const [settings, categories, incomeSources, accounts, statusLabels] = await Promise.all([
      prisma.settings.findUnique({ where: { userId } }),
      prisma.category.findMany({ where: { userId, isActive: true }, orderBy: { sortOrder: "asc" } }),
      prisma.incomeSource.findMany({ where: { userId, isActive: true }, orderBy: { createdAt: "asc" } }),
      prisma.account.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
      prisma.expectedStatusDefinition.findMany({ where: { userId }, orderBy: { sortOrder: "asc" } })
    ]);
    return NextResponse.json({ settings, categories, incomeSources, accounts, statusLabels });
  } catch (error) {
    return apiError(error, "Settings error");
  }
}

export async function PATCH(request: Request) {
  try {
    const userId = await requireApiUserId();
    const body = settingsPatchSchema.parse(await request.json());
    const monthlyExpenseLimit = body.monthlyExpenseLimit ? String(body.monthlyExpenseLimit) : "40000";
    const settings = await prisma.settings.update({
      where: { userId },
      data: {
        baseDisplayCurrency: body.baseDisplayCurrency,
        rateMode: body.rateMode,
        manualUahUsdtRate: body.manualUahUsdtRate ? String(body.manualUahUsdtRate) : null,
        monthlyExpenseLimit,
        greenMax: monthlyExpenseLimit,
        yellowMax: monthlyExpenseLimit,
        hideAmounts: body.hideAmounts,
        theme: body.theme === "dark" ? "dark" : "light"
      }
    });
    return NextResponse.json(settings);
  } catch (error) {
    return apiError(error, "Settings error");
  }
}
