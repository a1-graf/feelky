import { CircleDollarSign, RefreshCw, Snowflake, SquareArrowOutUpRight } from "lucide-react";
import { DonutBreakdown } from "@/components/donut-breakdown";
import { IncomeCharts } from "@/components/home/income-charts";
import { PeriodPicker } from "@/components/period-picker";
import { RangeAreaChart } from "@/components/range-area-chart";
import { TransactionList } from "@/components/transaction-list";
import { Card } from "@/components/ui/card";
import { bankSeries } from "@/lib/bank-history";
import { CHART_COLORS } from "@/lib/chart-colors";
import { getDashboard } from "@/lib/dashboard";
import { getExpensesPage } from "@/lib/expenses";
import { formatMoney, formatPercent, formatPlain } from "@/lib/money";
import { requireUserId } from "@/lib/session";

// The previous home page (two hero versions, «Підсумковий результат», «Структура банку», «Рахунки» …) is kept in
// components/archive/home-v1; projects/feelky/ui-research/ARCHIVE.md explains every hidden block.

type Row = { label: string; value: string };

function Dot({ className }: { className: string }) {
  return <span aria-hidden="true" className={`inline-block h-2.5 w-2.5 rounded-full ${className}`} />;
}

/** One of the six squares under the chart: a plain caption with a small icon, the number, its UAH value and the biggest parts. */
function Tile({ icon, label, value, valueClass = "", sub, rows, rowSigned = false, hidden }: { icon: React.ReactNode; label: string; value: string; valueClass?: string; sub: string; rows: Row[]; rowSigned?: boolean; hidden: boolean }) {
  return (
    <Card className="flex min-w-0 flex-col p-3.5 sm:p-4">
      <div className="flex items-center gap-1.5 text-[13px] text-[hsl(var(--card-muted-foreground))]">
        <span className="grid h-4 w-4 shrink-0 place-items-center">{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <div className={`mt-2 break-words text-xl font-bold leading-tight tabular-nums sm:text-2xl ${valueClass}`}>{value}</div>
      <div className="mt-0.5 text-xs tabular-nums text-[hsl(var(--card-muted-foreground))]">{sub}</div>
      {rows.length > 0 && (
        <dl className="mt-3 space-y-1 border-t border-border/60 pt-2 text-xs">
          {rows.map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-2">
              <dt className="min-w-0 truncate text-[hsl(var(--card-muted-foreground))]" title={row.label}>{row.label}</dt>
              <dd className="shrink-0 font-medium tabular-nums">{rowSigned && Number(row.value) > 0 && !hidden ? "+" : ""}{formatPlain(row.value, hidden)}</dd>
            </div>
          ))}
        </dl>
      )}
    </Card>
  );
}

/** One of the four project squares: fully painted green for a profit (or zero) and red for a loss, with a slow soft shimmer. */
function ProjectTile({ label, value, sub, hidden }: { label: string; value: number; sub: string; hidden: boolean }) {
  return (
    <div className={`project-tile ${value >= 0 ? "project-tile-pos" : "project-tile-neg"} min-w-0 rounded-2xl p-3.5 sm:p-4`}>
      <div className="truncate text-[13px]">{label}</div>
      <div className="mt-2 break-words text-xl font-bold leading-tight tabular-nums sm:text-2xl">{(value > 0 && !hidden ? "+" : "") + formatPlain(value, hidden)}</div>
      <div className="mt-0.5 text-xs tabular-nums opacity-90">{sub}</div>
    </div>
  );
}

/** The one main page: bank and rate, the bank chart, six tiles, this month's spending, income, and the latest operations at the bottom. */
export default async function OverviewPage({ searchParams }: { searchParams?: Promise<{ month?: string; period?: string }> }) {
  const userId = await requireUserId();
  const params = await searchParams;
  const [data, monthExpenses] = await Promise.all([
    getDashboard(userId, { month: params?.month, period: params?.period }),
    getExpensesPage(userId, { period: "month" })
  ]);
  const hidden = Boolean(data.settings?.hideAmounts);
  const rate = Number(data.rate);
  const asUah = (value: string | number) => `≈ ${formatMoney(Number(value) * rate, "UAH", hidden)}`;
  const signed = (value: number) => (value > 0 && !hidden ? "+" : "") + formatPlain(value, hidden);
  const negative = (value: number) => (value > 0 && !hidden ? "−" : "") + formatPlain(value, hidden);
  const periodPnl = Number(data.totals.periodNetPnlUsdt);
  const profit = Number(data.totals.periodProfitUsdt);
  const spend = Number(data.totals.periodSpendUsdt);
  const loss = Number(data.totals.periodLossUsdt);
  const turnoverRows: Row[] = [
    { label: "Steam", value: data.turnover.steamUsdt },
    { label: "Aurum", value: data.turnover.aurumUsdt },
    { label: "Polymarket", value: data.turnover.polyUsdt }
  ];

  const projects = [
    { label: "Фліпи", value: Number(data.projects.flipsUsdt) },
    { label: "Вилки", value: Number(data.projects.forksUsdt) },
    { label: "Steam", value: Number(data.projects.steamUsdt) },
    { label: "Форекс", value: Number(data.projects.fxUsdt) }
  ];

  const monthPersonalUah = Number(monthExpenses.totals.personalUah);
  const limit = Number(data.settings?.monthlyExpenseLimit?.toString() || 0);
  const limitRatio = limit > 0 ? Math.min(1, monthPersonalUah / limit) : 0;
  const overLimit = limit > 0 && monthPersonalUah > limit;

  return (
    <>
      {/* 1. Available bank on the left, the rate on the right, in one rectangle. */}
      <Card className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch sm:justify-between">
          <div className="min-w-0">
            <div className="text-sm text-[hsl(var(--card-muted-foreground))]">Доступний банк</div>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
              <span className="break-words text-4xl font-bold leading-none tracking-tight tabular-nums sm:text-5xl">{formatPlain(data.totals.availableBankUsdt, hidden)}</span>
              <span className="text-sm font-semibold text-[hsl(var(--card-muted-foreground))]">USDT</span>
            </div>
            <div className="mt-2 text-sm tabular-nums text-[hsl(var(--card-muted-foreground))]">{asUah(data.totals.availableBankUsdt)}</div>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-3 sm:flex-col sm:items-end sm:justify-center sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
            <div className="text-sm text-[hsl(var(--card-muted-foreground))]">Курс</div>
            <div className="text-right">
              <div className="text-2xl font-bold leading-none tabular-nums sm:text-3xl">{formatPlain(data.rate)}</div>
              <div className="mt-1 text-xs text-[hsl(var(--card-muted-foreground))]">UAH за 1 USDT</div>
            </div>
          </div>
        </div>
      </Card>

      {/* 2. The whole bank over time. */}
      <Card className="mt-3">
        <div className="mb-2 font-semibold">Загальний банк</div>
        <RangeAreaChart data={bankSeries(data.bankHistory, "total")} currency="USDT" hidden={hidden} totalLabel="Банк" emptyLabel="Поки немає історії" defaultPreset="1m" minimal smooth />
      </Card>

      {/* 3. Six tiles, 3×2: turnover, frozen, net PnL / profit, losses, expenses. */}
      <div className="mt-4">
        <PeriodPicker basePath="/overview" period={data.period} presets={["week", "month", "3m", "all"]} />
        <div className="mt-1.5 px-1 text-xs text-[hsl(var(--card-muted-foreground))]">
          Оборот і заморожене — на зараз; PnL, прибуток, мінуси, витрати й проєкти — за період «{data.period.label}»
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3">
        <Tile hidden={hidden} icon={<RefreshCw className="h-3.5 w-3.5" />} label="В обороті" value={formatPlain(data.turnover.totalUsdt, hidden)} sub={asUah(data.turnover.totalUsdt)} rows={turnoverRows} />
        <Tile hidden={hidden} icon={<Snowflake className="h-3.5 w-3.5" />} label="Заморожено" value={formatPlain(data.totals.frozenTotalUsdt, hidden)} sub={asUah(data.totals.frozenTotalUsdt)} rows={data.totals.frozenBreakdown} />
        <Tile hidden={hidden} icon={<CircleDollarSign className="h-3.5 w-3.5" />} label="Чистий PnL" value={signed(periodPnl)} valueClass={periodPnl >= 0 ? "text-success" : "tone-neg text-danger"} sub={asUah(periodPnl)} rows={data.totals.pnlBreakdown} rowSigned />
        <Tile hidden={hidden} icon={<Dot className="bg-success" />} label="Прибуток" value={signed(profit)} valueClass="text-success" sub={asUah(profit)} rows={data.totals.profitBreakdown} />
        <Tile hidden={hidden} icon={<Dot className="bg-danger" />} label="Мінуси" value={negative(loss)} valueClass={loss > 0 ? "tone-neg text-danger" : ""} sub={asUah(-loss)} rows={data.totals.lossBreakdown} />
        <Tile hidden={hidden} icon={<SquareArrowOutUpRight className="h-3.5 w-3.5 text-danger" />} label="Витрати" value={negative(spend)} valueClass={spend > 0 ? "tone-neg text-danger" : ""} sub={asUah(-spend)} rows={data.totals.spendBreakdown} />
      </div>

      {/* 3b. Profit of each project over the same period: 4 in a row on desktop, 2×2 on a phone. */}
      <div className="mt-2.5 grid grid-cols-2 gap-2.5 sm:mt-3 sm:gap-3 lg:grid-cols-4">
        {projects.map((project) => (
          <ProjectTile key={project.label} hidden={hidden} label={project.label} value={project.value} sub={asUah(project.value)} />
        ))}
      </div>

      {/* 4. This month's spending by category. */}
      <Card className="mt-4">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3">
          <div className="font-semibold">Витрати за {monthExpenses.period.label}</div>
          <div className="text-sm font-semibold tabular-nums">{formatMoney(monthExpenses.totals.totalUsdt, "USDT", hidden)}</div>
        </div>
        <div className="mb-3 text-sm text-[hsl(var(--card-muted-foreground))]">
          Особисті {formatMoney(monthPersonalUah, "UAH", hidden)} · робочі {formatMoney(monthExpenses.totals.workUsdt, "USDT", hidden)} · у середньому {formatMoney(monthExpenses.totals.dailyAverageUsdt, "USDT", hidden)} на день
        </div>
        {limit > 0 && (
          <div className="mb-4">
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span className="text-[hsl(var(--card-muted-foreground))]">Ліміт особистих {formatMoney(limit, "UAH", hidden)}</span>
              <span className={overLimit ? "font-semibold text-danger" : "text-[hsl(var(--card-muted-foreground))]"}>{formatPercent((monthPersonalUah / limit) * 100, hidden)}</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
              <div className={`h-full rounded-full ${overLimit ? "bg-danger" : limitRatio > 0.8 ? "bg-warning" : "bg-success"}`} style={{ width: `${Math.max(2, limitRatio * 100)}%` }} />
            </div>
          </div>
        )}
        <DonutBreakdown compact items={monthExpenses.byCategory} colors={CHART_COLORS} currency="USDT" hidden={hidden} emptyLabel="Цього місяця витрат ще немає" />
      </Card>

      {/* 5. Income: growing total and what brings it in. */}
      <IncomeCharts data={data} hidden={hidden} />

      {/* 6. One list of the latest operations of every kind, at the very bottom. */}
      <Card className="mt-4">
        <div className="mb-3 font-semibold">Останні транзакції</div>
        <TransactionList items={data.latestTransactions} compact hidden={hidden} />
      </Card>
    </>
  );
}
