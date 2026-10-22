import { BackToOverview } from "@/components/back-to-overview";
import { BreakdownBars } from "@/components/breakdown-bars";
import { DonutBreakdown } from "@/components/donut-breakdown";
import { ExpandableList } from "@/components/expandable-list";
import { PageTitle } from "@/components/page-title";
import { PeriodPicker } from "@/components/period-picker";
import { RangeAreaChart } from "@/components/range-area-chart";
import { TransactionList } from "@/components/transaction-list";
import { Card } from "@/components/ui/card";
import { getIncomePage } from "@/lib/income";
import { formatMoney } from "@/lib/money";
import { chartPresetFor } from "@/lib/period";
import { requireUserId } from "@/lib/session";

const COLORS = ["#2563eb", "#e8795f", "#16a34a", "#d99b42", "#8b5cf6", "#0ea5e9", "#ec4899", "#64748b"];

export default async function IncomePage({ searchParams }: { searchParams?: Promise<{ month?: string; period?: string }> }) {
  const userId = await requireUserId();
  const params = await searchParams;
  const data = await getIncomePage(userId, { month: params?.month, period: params?.period });
  const { hidden, totals, period } = data;

  return (
    <>
      <BackToOverview />
      <PageTitle title="Доходи" subtitle={`Надходження за джерелами без подвійного врахування · ${period.label}`} />
      <PeriodPicker basePath="/income" period={period} presets={["week", "month", "3m", "6m", "12m", "all"]} />

      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3">
        <Card className="col-span-2 border-success/30 bg-success/10 p-3.5 sm:p-4 md:col-span-1">
          <div className="text-[11px] font-medium text-success sm:text-[13px]">Всього доходу</div>
          <div className="mt-1 text-xl font-bold tabular-nums text-success sm:text-2xl">{formatMoney(totals.totalUsdt, "USDT", hidden)}</div>
          <div className="mt-1 text-xs text-[hsl(var(--card-muted-foreground))]">UAH + USDT за курсом {Number(data.rate).toFixed(2)}</div>
        </Card>
        <Card className="p-3.5 sm:p-4">
          <div className="text-[11px] font-medium text-[hsl(var(--card-muted-foreground))] sm:text-[13px]">Прийшло в UAH</div>
          <div className="mt-1 text-lg font-bold tabular-nums sm:text-[22px]">{formatMoney(totals.uah, "UAH", hidden)}</div>
        </Card>
        <Card className="p-3.5 sm:p-4">
          <div className="text-[11px] font-medium text-[hsl(var(--card-muted-foreground))] sm:text-[13px]">Прийшло в USDT / USD</div>
          <div className="mt-1 text-lg font-bold tabular-nums sm:text-[22px]">{formatMoney(totals.usdt, "USDT", hidden)}</div>
        </Card>
      </div>

      <Card className="mt-4">
        <div className="mb-1 font-semibold">Дохід у часі</div>
        <div className="mb-3 text-sm text-[hsl(var(--card-muted-foreground))]">Наростаючий підсумок у USDT, усі джерела разом</div>
        <RangeAreaChart key={period.key} data={data.series} hidden={hidden} totalLabel="Всього" emptyLabel="Поки немає доходів" defaultPreset={chartPresetFor(period.key)} minimal />
      </Card>

      <Card className="mt-4">
        <ExpandableList
          title="Операції"
          count={totals.count}
          preview={<TransactionList items={data.recent.slice(0, 1)} compact />}
          full={<TransactionList items={data.recent} compact />}
        />
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 font-semibold">За джерелами</div>
          <DonutBreakdown compact items={data.bySource} colors={COLORS} currency="USDT" hidden={hidden} emptyLabel="Поки немає доходів" />
        </Card>
        <Card>
          <div className="mb-3 font-semibold">За типом</div>
          <DonutBreakdown compact items={data.byType} colors={COLORS} currency="USDT" hidden={hidden} emptyLabel="Поки немає доходів" />
        </Card>
      </div>

      <Card className="mt-4">
        <div className="mb-1 font-semibold">Результат модулів</div>
        <div className="mb-3 text-sm text-[hsl(var(--card-muted-foreground))]">Aurum, Polymarket, Steam і фліпи за період, USDT</div>
        <BreakdownBars items={data.modules} hidden={hidden} />
      </Card>
    </>
  );
}
