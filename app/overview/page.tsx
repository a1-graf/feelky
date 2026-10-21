import Link from "next/link";
import { ArrowRight, CalendarDays, ChevronDown } from "lucide-react";
import { DashboardStatistics } from "@/components/dashboard-statistics";
import { MetricGrid } from "@/components/metric-grid";
import { Card } from "@/components/ui/card";
import { getDashboard } from "@/lib/dashboard";
import { formatMoney } from "@/lib/money";
import { requireUserId } from "@/lib/session";

const financeLinks = [
  { href: "/fx", label: "FX", priority: true },
  { href: "/poly", label: "Polymarket", priority: true },
  { href: "/steam", label: "Steam", priority: true },
  { href: "/income", label: "Доходи" },
  { href: "/expenses", label: "Витрати" },
  { href: "/withdrawals", label: "Виводи" },
  { href: "/crypto", label: "Гаманець" },
  { href: "/expected", label: "Заморожені" },
  { href: "/savings", label: "Відкладення" },
  { href: "/flips", label: "Фліпи" }
];

const monthLabels = [
  "Січень", "Лютий", "Березень", "Квітень", "Травень", "Червень",
  "Липень", "Серпень", "Вересень", "Жовтень", "Листопад", "Грудень"
];

/** The one main page: the bank right now on top, then everything about the chosen month. */
export default async function OverviewPage({ searchParams }: { searchParams?: Promise<{ month?: string }> }) {
  const userId = await requireUserId();
  const params = await searchParams;
  const data = await getDashboard(userId, { month: params?.month });
  const hidden = Boolean(data.settings?.hideAmounts);
  const rate = Number(data.rate);
  const asUah = (value: string) => formatMoney(Number(value) * rate, "UAH", hidden);
  const asUsdt = (value: string) => formatMoney(Number(value) / rate, "USDT", hidden);
  const monthExpense = Number(data.totals.monthExpenseUah);
  const limit = Number(data.settings?.monthlyExpenseLimit?.toString() || 0);
  const limitRatio = limit > 0 ? Math.min(1, monthExpense / limit) : 0;
  const overLimit = limit > 0 && monthExpense > limit;
  const netPnl = Number(data.totals.netPnlUsdt);
  const currentYear = new Date().getFullYear();

  return (
    <>
      <div className="hero-gradient relative overflow-hidden rounded-3xl p-5 text-white shadow-soft sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-28 right-16 h-56 w-56 rounded-full bg-black/10 blur-2xl" />
        <div className="relative">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="text-sm font-medium text-white/75">Доступний банк</div>
            <div className="text-xs font-medium text-white/60">курс {data.rate} UAH/USDT</div>
          </div>
          <div className="mt-2 break-words text-4xl font-bold leading-none tracking-tight sm:text-5xl">
            {formatMoney(data.totals.availableBankUsdt, "USDT", hidden)}
          </div>
          <div className="mt-2 text-lg font-semibold text-white/85">{asUah(data.totals.availableBankUsdt)}</div>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-white/12 px-3 py-2 ring-1 ring-white/20">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-200">Повний</div>
              <div className="mt-0.5 text-base font-extrabold text-amber-100">{formatMoney(data.totals.potentialBankUsdt, "USDT", hidden)}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-white/60">Заморожено</div>
              <div className="mt-0.5 text-sm font-semibold text-white/90">{formatMoney(data.totals.frozenTotalUsdt, "USDT", hidden)}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-white/60">В обороті Steam</div>
              <div className="mt-0.5 text-sm font-semibold text-white/90">{formatMoney(data.steam.frozenCapital, "USDT", hidden)}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-white/60">Чистий PnL</div>
              <div className={`mt-0.5 text-sm font-semibold ${netPnl >= 0 ? "text-emerald-200" : "text-rose-200"}`}>
                {formatMoney(data.totals.netPnlUsdt, "USDT", hidden)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 md:hidden">
        {financeLinks.filter((link) => link.priority).map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`flex min-h-12 items-center justify-center rounded-xl border px-2 py-2.5 text-center text-xs font-semibold shadow-card transition-colors active:bg-muted ${
              link.priority ? "border-primary/25 bg-primary/10 text-primary" : "border-border/70 bg-card"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </div>

      <details className="group mt-3 rounded-2xl border border-border/60 bg-card/80 shadow-card md:hidden">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm font-semibold [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            Період: {data.period.label}
          </span>
          <ChevronDown className="h-4 w-4 text-[hsl(var(--card-muted-foreground))] transition-transform group-open:rotate-180" />
        </summary>
        <form action="/overview" className="grid gap-3 border-t border-border/60 p-4">
          <label>
            Місяць
            <select name="month" defaultValue={data.period.month}>
              {monthLabels.map((label, index) => {
                const month = `${currentYear}-${String(index + 1).padStart(2, "0")}`;
                return <option key={month} value={month}>{label} {currentYear} р.</option>;
              })}
            </select>
          </label>
          <button className="min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground" type="submit">
            Показати період
          </button>
          {!data.period.isCurrentMonth && (
            <Link href="/overview" className="text-center text-sm font-medium text-primary">Повернутись до поточного місяця</Link>
          )}
        </form>
      </details>

      <Card className="mt-4 hidden p-4 md:block">
        <form action="/overview" className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <label>
            Місяць
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
          <Link href="/overview" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-muted px-4 py-2 text-sm font-semibold text-[hsl(var(--card-foreground))]">
            Теперішній місяць
          </Link>
        </form>
        <div className="mt-3 text-sm text-[hsl(var(--card-muted-foreground))]">
          Банк зверху — на зараз, усе нижче — за період{" "}
          <span className="font-semibold text-[hsl(var(--card-foreground))]">{data.period.rangeLabel}</span>
        </div>
      </Card>

      <div className="mt-4">
        <MetricGrid
          items={[
            { label: "Мейн гаманець", value: formatMoney(data.totals.cryptoTotal, "USDT", hidden), subValue: asUah(data.totals.cryptoTotal) },
            { label: "Картка", value: formatMoney(data.totals.cardUah, "UAH", hidden), subValue: asUsdt(data.totals.cardUah) },
            { label: "Готівка", value: formatMoney(data.totals.cashUah, "UAH", hidden), subValue: `${formatMoney(data.totals.cashUsd, "USD", hidden)} cash` },
            { label: "Відкладення", value: formatMoney(data.totals.savingsUah, "UAH", hidden), subValue: asUsdt(data.totals.savingsUah) },
            { label: `Витрати · ${data.period.label}`, value: formatMoney(data.totals.monthExpenseUah, "UAH", hidden), tone: overLimit ? "danger" : "ok", subValue: limit > 0 ? `ліміт ${formatMoney(limit, "UAH", hidden)}` : "без ліміту" },
            { label: "Steam PnL", value: formatMoney(data.steam.profit, "USDT", hidden), tone: Number(data.steam.profit) >= 0 ? "ok" : "danger" }
          ]}
          desktopColumns={3}
        />
      </div>

      {limit > 0 && (
        <Card className="mt-4 p-4">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium">Ліміт витрат на місяць</span>
            <span className={overLimit ? "font-semibold text-danger" : "text-[hsl(var(--card-muted-foreground))]"}>
              {Math.round((monthExpense / limit) * 100)}%
            </span>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all ${overLimit ? "bg-danger" : limitRatio > 0.8 ? "bg-warning" : "bg-success"}`}
              style={{ width: `${Math.max(2, limitRatio * 100)}%` }}
            />
          </div>
        </Card>
      )}

      <DashboardStatistics data={data} />

      <div className="mt-4 hidden grid-cols-3 gap-3 md:grid">
        {financeLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="group flex items-center justify-center rounded-2xl border border-border/70 bg-card px-2 py-3 text-[13px] font-semibold shadow-card transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-soft sm:justify-between sm:px-4 sm:py-3.5 sm:text-sm"
          >
            {link.label}
            <ArrowRight className="hidden h-4 w-4 text-[hsl(var(--card-muted-foreground))] transition-transform group-hover:translate-x-0.5 group-hover:text-primary sm:block" />
          </Link>
        ))}
      </div>
    </>
  );
}
