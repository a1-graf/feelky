import { BackToStatistics } from "@/components/back-to-statistics";
import { AppShell } from "@/components/layout/app-shell";
import { PageTitle } from "@/components/page-title";
import { SettingsForm } from "@/components/forms/settings-form";
import { ReferenceManager } from "@/components/forms/reference-manager";
import { AccountBalanceManager } from "@/components/forms/account-balance-manager";
import { Card } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SettingsPage() {
  const userId = await requireUserId();
  const [settings, categories, incomeSources, accounts] = await Promise.all([
    prisma.settings.findUnique({ where: { userId } }),
    prisma.category.findMany({ where: { userId, isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.incomeSource.findMany({ where: { userId, isActive: true }, orderBy: { createdAt: "asc" } }),
    prisma.account.findMany({ where: { userId, isActive: true }, orderBy: { createdAt: "asc" } })
  ]);
  return (
    <AppShell>
      <BackToStatistics />
      <PageTitle title="Налаштування" subtitle="Профіль, довідники, курс, тема, приховування сум і backup" />
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <SettingsForm settings={settings ? {
          baseDisplayCurrency: settings.baseDisplayCurrency,
          rateMode: settings.rateMode,
          manualUahUsdtRate: settings.manualUahUsdtRate?.toString() || "",
          monthlyExpenseLimit: settings.monthlyExpenseLimit.toString(),
          hideAmounts: settings.hideAmounts,
          theme: settings.theme
        } : null} />
        <ReferenceManager
          title="Категорії витрат"
          addLabel="Нова категорія"
          kind="category"
          items={categories.map((item) => ({ id: item.id, name: item.name, isActive: item.isActive }))}
        />
        <ReferenceManager
          title="Джерела доходів"
          addLabel="Нове джерело"
          kind="incomeSource"
          items={incomeSources.map((item) => ({ id: item.id, name: item.name, isActive: item.isActive }))}
        />
        <AccountBalanceManager
          accounts={accounts.map((account) => ({
            id: account.id,
            name: account.name,
            type: account.type,
            currency: account.currency,
            currentBalance: account.currentBalance.toString(),
            isActive: account.isActive
          }))}
        />
        <Card>
          <div className="font-semibold">Довідники</div>
          <div className="mt-3 grid gap-3 text-sm">
            <div><b>Рахунки:</b> {accounts.map((item) => `${item.name} ${item.currency}`).join(", ")}</div>
            <a className="inline-flex min-h-11 items-center rounded-lg bg-muted px-4" href="/api/backup">Експорт JSON</a>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
