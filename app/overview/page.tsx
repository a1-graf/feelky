import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { BalanceGrowthChart } from "@/components/balance-growth-chart";
import { MetricGrid } from "@/components/metric-grid";
import { TransactionList } from "@/components/transaction-list";
import { Card } from "@/components/ui/card";
import { getDashboard } from "@/lib/dashboard";
import { formatMoney } from "@/lib/money";
import { requireUserId } from "@/lib/session";

const financeLinks = [
  { href: "/income", label: "Доходи" },
  { href: "/expenses", label: "Витрати" },
  { href: "/withdrawals", label: "Виводи" },
  { href: "/crypto", label: "Гаманець" },
  { href: "/expected", label: "Заморожені" },
  { href: "/savings", label: "Відкладення" },
  { href: "/flips", label: "Фліпи" },
  { href: "/steam", label: "Steam" }
];

export default async function OverviewPage() {
  const userId = await requireUserId();
  const data = await getDashboard(userId);
  const hidden = Boolean(data.settings?.hideAmounts);
  const rate = Number(data.rate);
  const asUah = (value: string) => formatMoney(Number(value) * rate, "UAH", hidden);
  const asUsdt = (value: string) => formatMoney(Number(value) / rate, "USDT", hidden);
  const monthExpense = Number(data.totals.monthExpenseUah);
  const limit = Number(data.settings?.monthlyExpenseLimit?.toString() || 0);
  const limitRatio = limit > 0 ? Math.min(1, monthExpense / limit) : 0;
  const overLimit = limit > 0 && monthExpense > limit;
  const netPnl = Number(data.totals.netPnlUsdt);

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

      <Card className="mt-4 p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="font-semibold">Динаміка банку</div>
          <Link href="/statistics" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            Вся статистика <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
        <BalanceGrowthChart data={data.balanceTimeline} rate={data.rate} hidden={hidden} />
      </Card>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {financeLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="group flex items-center justify-between rounded-2xl border border-border/70 bg-card px-4 py-3.5 text-sm font-semibold shadow-card transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-soft"
          >
            {link.label}
            <ArrowRight className="h-4 w-4 text-[hsl(var(--card-muted-foreground))] transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
          </Link>
        ))}
      </div>

      <Card className="mt-4 p-4 sm:p-5">
        <div className="mb-2 text-sm font-semibold">Останні операції</div>
        <TransactionList items={data.recentTransactions} compact />
      </Card>
    </>
  );
}