import { BackToOverview } from "@/components/back-to-overview";
import { DonutBreakdown } from "@/components/donut-breakdown";
import { ExpandableList } from "@/components/expandable-list";
import { PageTitle } from "@/components/page-title";
import { PeriodPicker } from "@/components/period-picker";
import { RangeAreaChart } from "@/components/range-area-chart";
import { TransactionList } from "@/components/transaction-list";
import { Card } from "@/components/ui/card";
import { CHART_COLORS } from "@/lib/chart-colors";
import { formatMoney, formatPlain } from "@/lib/money";
import { chartPresetFor } from "@/lib/period";
import { requireUserId } from "@/lib/session";
import { getWithdrawalsPage } from "@/lib/withdrawals";

export default async function WithdrawalsPage({ searchParams }: { searchParams?: Promise<{ month?: string; period?: string }> }) {
  const userId = await requireUserId();
  const params = await searchParams;
  const data = await getWithdrawalsPage(userId, { month: params?.month, period: params?.period });
  const { hidden, totals, period } = data;

  return (
    <>
      <BackToOverview />
      <PageTitle title="Виводи й заводи" subtitle={`P2P і готівкові конвертації · ${period.label}`} />
      <PeriodPicker basePath="/withdrawals" period={period} presets={["week", "month", "3m", "6m", "12m", "all"]} />

      <Card className="mt-4">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <div className="font-semibold">3 останні операції</div>
          <div className="text-xs text-[hsl(var(--card-muted-foreground))]">за обраний період</div>
        </div>
        <TransactionList items={data.recent.slice(0, 3)} compact hidden={hidden} />
      </Card>

      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3">
        <Card className="border-primary/30 bg-primary/10 p-3.5 sm:p-4">
          <div className="text-[11px] font-medium text-primary sm:text-[13px]">Виведено</div>
          <div className="mt-1 text-lg font-bold tabular-nums text-primary sm:text-[22px]">{formatMoney(totals.spentUsdt, "USDT", hidden)}</div>
          <div className="mt-1 text-xs text-[hsl(var(--card-muted-foreground))]">отримано {formatMoney(totals.receivedUah, "UAH", hidden)}</div>
        </Card>
        <Card className="p-3.5 sm:p-4">
          <div className="text-[11px] font-medium text-[hsl(var(--card-muted-foreground))] sm:text-[13px]">Готівка USD</div>
          <div className="mt-1 text-lg font-bold tabular-nums sm:text-[22px]">{formatMoney(totals.receivedUsd, "USD", hidden)}</div>
        </Card>
        <Card className="p-3.5 sm:p-4">
          <div className="text-[11px] font-medium text-[hsl(var(--card-muted-foreground))] sm:text-[13px]">Заведено</div>
          <div className="mt-1 text-lg font-bold tabular-nums sm:text-[22px]">{formatMoney(totals.depositedUsdt, "USDT", hidden)}</div>
          <div className="mt-1 text-xs text-[hsl(var(--card-muted-foreground))]">витрачено {formatMoney(totals.depositedUah, "UAH", hidden)}</div>
        </Card>
        <Card className="p-3.5 sm:p-4">
          <div className="text-[11px] font-medium text-[hsl(var(--card-muted-foreground))] sm:text-[13px]">Середній курс</div>
          <div className="mt-1 text-lg font-bold tabular-nums sm:text-[22px]">{formatPlain(totals.averageRate, hidden)}</div>
          <div className="mt-1 text-xs text-[hsl(var(--card-muted-foreground))]">UAH/USDT</div>
        </Card>
        <Card className="p-3.5 sm:p-4">
          <div className="text-[11px] font-medium text-[hsl(var(--card-muted-foreground))] sm:text-[13px]">Операцій</div>
          <div className="mt-1 text-lg font-bold tabular-nums sm:text-[22px]">{totals.count}</div>
        </Card>
      </div>

      <Card className="mt-4">
        <div className="mb-1 font-semibold">Обсяг конвертацій у часі</div>
        <div className="mb-3 text-sm text-[hsl(var(--card-muted-foreground))]">Виводи й заводи, приведені до USDT</div>
        <RangeAreaChart key={period.key} data={data.series} hidden={hidden} totalLabel="Обсяг" emptyLabel="Поки немає конвертацій" defaultPreset={chartPresetFor(period.key)} minimal showSummary={false} />
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 font-semibold">За способом</div>
          <DonutBreakdown compact items={data.byType} colors={CHART_COLORS} currency="USDT" hidden={hidden} emptyLabel="Поки немає конвертацій" />
        </Card>
        <Card>
          <div className="mb-3 font-semibold">Куди надійшло</div>
          <DonutBreakdown compact items={data.byDestination} colors={CHART_COLORS} currency="USDT" hidden={hidden} emptyLabel="Поки немає конвертацій" />
        </Card>
      </div>

      <Card className="mt-4">
        <ExpandableList
          title="Усі операції"
          count={totals.count}
          preview={<TransactionList items={data.recent.slice(0, 1)} compact hidden={hidden} />}
          full={<TransactionList items={data.recent} compact hidden={hidden} />}
        />
      </Card>
    </>
  );
}
