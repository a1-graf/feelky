import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { DashboardStatistics } from "@/components/dashboard-statistics";
import { PageTitle } from "@/components/page-title";
import { Card } from "@/components/ui/card";
import { getDashboard } from "@/lib/dashboard";
import { formatMoney } from "@/lib/money";
import { requireUserId } from "@/lib/session";

const sections = [
  { href: "/income", label: "Доходи", description: "Всі надходження і джерела" },
  { href: "/expenses", label: "Витрати", description: "Категорії, суми і історія трат" },
  { href: "/withdrawals", label: "Виводи", description: "P2P та готівкові виводи" },
  { href: "/crypto", label: "Мейн гаманець", description: "Основні USDT в одному місці" },
  { href: "/expected", label: "Заморожені бабки", description: "Де лежать гроші і що треба забрати" },
  { href: "/savings", label: "Відкладення", description: "Накопичена сума та історія внесень" },
  { href: "/settings", label: "Налаштування", description: "Курс, тема, довідники і backup" }
];

const monthLabels = [
  "Січень", "Лютий", "Березень", "Квітень", "Травень", "Червень",
  "Липень", "Серпень", "Вересень", "Жовтень", "Листопад", "Грудень"
];

export default async function StatisticsPage({ searchParams }: { searchParams?: Promise<{ month?: string }> }) {
  const userId = await requireUserId();
  const params = await searchParams;
  const data = await getDashboard(userId, { month: params?.month });
  const currentYear = new Date().getFullYear();
  const hidden = Boolean(data.settings?.hideAmounts);
  const rate = Number(data.rate);
  const availableBankUah = Number(data.totals.availableBankUsdt) * rate;
  const potentialBankUah = Number(data.totals.potentialBankUsdt) * rate;

  return (
    <>
      <PageTitle title="Статистика" subtitle={`Деталі банку, витрат і доходів · курс ${data.rate} UAH/USDT`} />

      <Card className="mb-4 p-4">
        <form action="/statistics" className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <label>
            Місяць статистики
            <select name="month" defaultValue={data.period.month}>
              {monthLabels.map((label, index) => {
                const month = `${currentYear}-${String(index + 1).padStart(2, "0")}`;

                return <option key={month} value={month}>{label} {currentYear} р.</option>;
              })}
            </select>
          </label>
          <button className="min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground" type="submit">
            Показати
          </button>
          <Link href="/statistics" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-muted px-4 py-2 text-sm font-semibold text-[hsl(var(--card-foreground))]">
            Теперішній місяць
          </Link>
        </form>
        <div className="mt-3 text-sm text-[hsl(var(--card-muted-foreground))]">
          Період: <span className="font-semibold text-[hsl(var(--card-foreground))]">{data.period.rangeLabel}</span>
          {data.period.isCurrentMonth ? " · поточний місяць показаний до сьогодні" : ""}
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <div className="text-sm font-medium text-[hsl(var(--card-muted-foreground))]">Доступний банк</div>
        <div className="mt-2 break-words text-3xl font-semibold leading-none text-success sm:text-4xl">
          {formatMoney(data.totals.availableBankUsdt, "USDT", hidden)}
        </div>
        <div className="mt-2 text-base font-semibold text-[hsl(var(--card-foreground))] sm:text-lg">
          {formatMoney(availableBankUah, "UAH", hidden)}
        </div>
        <div className="mt-3 text-sm text-[hsl(var(--card-muted-foreground))]">
          Потенційний банк: <span className="font-semibold text-[hsl(var(--card-foreground))]">{formatMoney(data.totals.potentialBankUsdt, "USDT", hidden)} · {formatMoney(potentialBankUah, "UAH", hidden)}</span>
        </div>
      </Card>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {sections.map((section) => (
          <Link key={section.href} href={section.href} className="group rounded-lg border border-border bg-card p-4 text-[hsl(var(--card-foreground))] shadow-soft hover:bg-muted">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold">{section.label}</div>
                <div className="mt-1 text-sm text-[hsl(var(--card-muted-foreground))]">{section.description}</div>
              </div>
              <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--card-muted-foreground))] transition-transform group-hover:translate-x-0.5" />
            </div>
          </Link>
        ))}
      </div>

      <DashboardStatistics data={data} />
    </>
  );
}
