import Link from "next/link";
import { BackToOverview } from "@/components/back-to-overview";
import { PageTitle } from "@/components/page-title";
import { SettingsForm } from "@/components/forms/settings-form";
import { ReferenceManager } from "@/components/forms/reference-manager";
import { AccountBalanceManager } from "@/components/forms/account-balance-manager";
import { Card } from "@/components/ui/card";
import { ThemeSwitcher } from "@/components/layout/theme-switcher";
import { MobileLogout } from "@/components/layout/mobile-logout";
import { PushSettings } from "@/components/push-settings";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { MAIN_WALLET_NAME } from "@/lib/user-defaults";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const mobileMenuLinks = [
  { href: "/income", label: "Доходи" }, { href: "/expenses", label: "Витрати" },
  { href: "/withdrawals", label: "Виводи" }, { href: "/expected", label: "Заморожені" },
  { href: "/savings", label: "Відкладення" }, { href: "/flips", label: "Фліпи" }, { href: "/archive", label: "Архів" }
];
const sections = [
  ["profile", "Профіль"], ["themes", "Теми"], ["money", "Баланс і валюти"],
  ["limits", "Ліміти"], ["integrations", "Інтеграції"], ["data", "Дані й бекапи"]
] as const;

function SectionTitle({ id, title, text }: { id: string; title: string; text: string }) {
  return <div id={id} className="scroll-mt-6"><h2 className="text-lg font-semibold">{title}</h2><p className="mt-1 text-sm text-[hsl(var(--card-muted-foreground))]">{text}</p></div>;
}

export default async function SettingsPage() {
  const userId = await requireUserId();
  const [user, settings, categories, incomeSources, accounts] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } }),
    prisma.settings.findUnique({ where: { userId } }),
    prisma.category.findMany({ where: { userId, isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.incomeSource.findMany({ where: { userId, isActive: true }, orderBy: { createdAt: "asc" } }),
    prisma.account.findMany({ where: { userId, isActive: true }, orderBy: { createdAt: "asc" } })
  ]);
  const visibleAccounts = accounts.filter((account) => account.name !== MAIN_WALLET_NAME);
  return (
    <>
      <BackToOverview />
      <PageTitle title="Налаштування" subtitle="Один центр для профілю, тем, грошей, довідників та даних" />
      <Card className="mb-4 md:hidden"><div className="mb-3 font-semibold">Інші розділи</div><div className="grid grid-cols-2 gap-2">{mobileMenuLinks.map((link) => <Link key={link.href} href={link.href} className="flex min-h-11 items-center rounded-xl bg-muted px-3 text-sm font-medium">{link.label}</Link>)}</div></Card>

      <div className="grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-5 lg:self-start">
          <nav className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-2 lg:grid">
            {sections.map(([id, label]) => <a key={id} href={`#${id}`} className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-[hsl(var(--card-muted-foreground))] hover:bg-muted hover:text-foreground">{label}</a>)}
          </nav>
        </aside>
        <div className="grid gap-8">
          <section className="grid gap-3">
            <SectionTitle id="profile" title="Профіль" text="Ваш обліковий запис і поточний сеанс." />
            <Card className="flex flex-wrap items-center justify-between gap-4">
              <div><div className="font-semibold">{user?.name || "Граф"}</div><div className="text-sm text-[hsl(var(--card-muted-foreground))]">{user?.email || "Локальний профіль"}</div></div>
              <div className="md:hidden"><MobileLogout /></div>
            </Card>
          </section>

          <section className="grid gap-3">
            <SectionTitle id="themes" title="Теми" text="Зовнішній вигляд застосунку на цьому пристрої." />
            <Card><ThemeSwitcher /></Card>
          </section>

          <section className="grid gap-3">
            <SectionTitle id="money" title="Баланс і валюти" text="Курс, базова валюта та контроль видимих рахунків." />
            <SettingsForm settings={settings ? {
              baseDisplayCurrency: settings.baseDisplayCurrency, rateMode: settings.rateMode,
              manualUahUsdtRate: settings.manualUahUsdtRate?.toString() || "",
              monthlyExpenseLimit: settings.monthlyExpenseLimit.toString(), hideAmounts: settings.hideAmounts, theme: settings.theme
            } : null} />
            <AccountBalanceManager accounts={visibleAccounts.map((account) => ({
              id: account.id, name: account.name, type: account.type, currency: account.currency,
              currentBalance: account.currentBalance.toString(), isActive: account.isActive
            }))} />
          </section>

          <section className="grid gap-3">
            <SectionTitle id="limits" title="Ліміти й довідники" text="Категорії витрат і джерела доходів для швидкого внесення." />
            <div className="grid gap-4 xl:grid-cols-2">
              <ReferenceManager title="Категорії витрат" addLabel="Нова категорія" kind="category" items={categories.map((item) => ({ id: item.id, name: item.name, isActive: item.isActive }))} />
              <ReferenceManager title="Джерела доходів" addLabel="Нове джерело" kind="incomeSource" items={incomeSources.map((item) => ({ id: item.id, name: item.name, isActive: item.isActive }))} />
            </div>
          </section>

          <section className="grid gap-3">
            <SectionTitle id="integrations" title="Інтеграції" text="Підключені джерела даних працюють у фоновому режимі." />
            <Card><div className="grid gap-2 text-sm sm:grid-cols-3">{["OpenClaw агент", "Telegram-бот", "Vercel sync"].map((name) => <div key={name} className="flex items-center gap-2 rounded-lg bg-muted p-3"><span className="h-2 w-2 rounded-full bg-success" />{name}</div>)}</div></Card>
            <Card><PushSettings /></Card>
          </section>

          <section className="grid gap-3">
            <SectionTitle id="data" title="Дані й бекапи" text="Експорт створює копію для перенесення або аварійного відновлення." />
            <Card className="flex flex-wrap items-center justify-between gap-3">
              <div><div className="font-semibold">Експорт Feelky</div><div className="text-sm text-[hsl(var(--card-muted-foreground))]">{visibleAccounts.length} видимих рахунків · JSON</div></div>
              <a className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 font-semibold text-primary-foreground" href="/api/backup">Завантажити backup</a>
            </Card>
          </section>
        </div>
      </div>
    </>
  );
}
