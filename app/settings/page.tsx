import Link from "next/link";
import { BackToOverview } from "@/components/back-to-overview";
import { PageTitle } from "@/components/page-title";
import { SettingsForm } from "@/components/forms/settings-form";
import { ReferenceManager } from "@/components/forms/reference-manager";
import { AccountBalanceManager } from "@/components/forms/account-balance-manager";
import { Card } from "@/components/ui/card";
import { MobileLogout } from "@/components/layout/mobile-logout";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const mobileMenuLinks = [
  { href: "/income", label: "Доходи" },
  { href: "/expenses", label: "Витрати" },
  { href: "/withdrawals", label: "Виводи" },
  { href: "/crypto", label: "Гаманець" },
  { href: "/expected", label: "Заморожені" },
  { href: "/savings", label: "Відкладення" },
  { href: "/flips", label: "Фліпи" },
  { href: "/archive", label: "Архів" }
];

export default async function SettingsPage() {
  const userId = await requireUserId();
  const [settings, categories, incomeSources, accounts] = await Promise.all([
    prisma.settings.findUnique({ where: { userId } }),
    prisma.category.findMany({ where: { userId, isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.incomeSource.findMany({ where: { userId, isActive: true }, orderBy: { createdAt: "asc" } }),
    prisma.account.findMany({ where: { userId, isActive: true }, orderBy: { createdAt: "asc" } })
  ]);
  return (
    <>
      <BackToOverview />
      <PageTitle title="Налаштування" subtitle="Профіль, довідники, курс, тема, приховування сум і backup" />
      <Card className="mb-4 md:hidden">
        <div className="mb-3 font-semibold">Інші розділи</div>
        <div className="grid grid-cols-2 gap-2">
          {mobileMenuLinks.map((link) => (
            <Link key={link.href} href={link.href} className="flex min-h-11 items-center rounded-xl bg-muted px-3 text-sm font-medium">
              {link.label}
            </Link>
          ))}
        </div>
      </Card>
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
        <Card className="md:hidden">
          <div className="mb-2 font-semibold">Сеанс</div>
          <MobileLogout />
        </Card>
      </div>
    </>
  );
}
