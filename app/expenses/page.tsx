import { BackToOverview } from "@/components/back-to-overview";
import { DonutBreakdown } from "@/components/donut-breakdown";
import { ExpandableList } from "@/components/expandable-list";
import { PageTitle } from "@/components/page-title";
import { PeriodPicker } from "@/components/period-picker";
import { RangeAreaChart } from "@/components/range-area-chart";
import { TransactionList } from "@/components/transaction-list";
import { TransactionExplorer } from "@/components/transaction-explorer";
import { Card } from "@/components/ui/card";
import { CHART_COLORS, LOSS_COLOR } from "@/lib/chart-colors";
import { getExpensesPage } from "@/lib/expenses";
import { formatMoney, formatPlain } from "@/lib/money";
import { chartPresetFor } from "@/lib/period";
import { requireUserId } from "@/lib/session";

export default async function ExpensesPage({ searchParams }: { searchParams?: Promise<{ month?: string; period?: string }> }) {
  const userId = await requireUserId();
  const params = await searchParams;
  const data = await getExpensesPage(userId, { month: params?.month, period: params?.period });
  const { hidden, totals, period } = data;

  return (
    <>
      <BackToOverview />
      <PageTitle title="Витрати" subtitle={`Особисті й робочі витрати без змішування · ${period.label}`} />
      <PeriodPicker basePath="/expenses" period={period} presets={["week", "month", "3m", "6m", "12m", "all"]} />

      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-4">
        <Card className="col-span-2 border-danger/30 bg-danger/10 p-3.5 sm:p-4 md:col-span-1">
          <div className="text-[11px] font-medium text-danger sm:text-[13px]">Витрати за період</div>
          <div className="mt-1 text-xl font-bold tabular-nums text-danger sm:text-2xl">{formatMoney(totals.totalUsdt, "USDT", hidden)}</div>
          <div className="mt-1 text-xs text-[hsl(var(--card-muted-foreground))]">UAH + USDT за курсом {formatPlain(data.rate)}</div>
        </Card>
        <Card className="p-3.5 sm:p-4">
          <div className="text-[11px] font-medium text-[hsl(var(--card-muted-foreground))] sm:text-[13px]">Особисті витрати</div>
          <div className="mt-1 text-lg font-bold tabular-nums sm:text-[22px]">{formatMoney(totals.personalUah, "UAH", hidden)}</div>
        </Card>
        <Card className="p-3.5 sm:p-4">
          <div className="text-[11px] font-medium text-[hsl(var(--card-muted-foreground))] sm:text-[13px]">Робочі витрати</div>
          <div className="mt-1 text-lg font-bold tabular-nums sm:text-[22px]">{formatMoney(totals.workUsdt, "USDT", hidden)}</div>
        </Card>
        <Card className="p-3.5 sm:p-4">
          <div className="text-[11px] font-medium text-[hsl(var(--card-muted-foreground))] sm:text-[13px]">У середньому за день</div>
          <div className="mt-1 text-lg font-bold tabular-nums sm:text-[22px]">{formatMoney(totals.dailyAverageUsdt, "USDT", hidden)}</div>
          <div className="mt-1 text-xs text-[hsl(var(--card-muted-foreground))]">Операцій: {totals.count}</div>
        </Card>
      </div>

      <Card className="mt-4">
        <div className="mb-1 font-semibold">Витрати у часі</div>
        <div className="mb-3 text-sm text-[hsl(var(--card-muted-foreground))]">Наростаючий обсяг усіх витрат у USDT</div>
        <RangeAreaChart key={period.key} data={data.series} hidden={hidden} color={LOSS_COLOR} totalLabel="Витрачено" emptyLabel="Поки немає витрат" defaultPreset={chartPresetFor(period.key)} minimal showSummary={false} />
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 font-semibold">За категоріями й напрямками</div>
          <DonutBreakdown compact items={data.byCategory} colors={CHART_COLORS} currency="USDT" hidden={hidden} emptyLabel="Поки немає витрат" />
        </Card>
        <Card>
          <div className="mb-3 font-semibold">Особисті та робочі</div>
          <DonutBreakdown compact items={data.byType} colors={CHART_COLORS} currency="USDT" hidden={hidden} emptyLabel="Поки немає витрат" />
        </Card>
      </div>

      <Card className="mt-4">
        <ExpandableList
          title="Операції"
          count={totals.count}
          preview={<TransactionList items={data.recent.slice(0, 1)} compact hidden={hidden} />}
          full={<TransactionExplorer items={data.recent} hidden={hidden} />}
        />
      </Card>
    </>
  );
}
