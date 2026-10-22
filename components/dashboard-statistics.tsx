import { DonutBreakdown } from "@/components/donut-breakdown";
import { IncomeLineChart, IncomeSourceGrowthChart } from "@/components/income-line-chart";
import { RangeAreaChart, type RangePoint } from "@/components/range-area-chart";
import { TransactionList } from "@/components/transaction-list";
import { Card } from "@/components/ui/card";
import { chartPresetFor } from "@/lib/period";

type DashboardStatsData = {
  period: { key: string; label: string; rangeLabel: string };
  rate: string;
  settings: { hideAmounts: boolean } | null;
  incomeTimeline: { date: string; label: string; usdt: number; uah: number }[];
  incomeSourceTimeline: { date: string; label: string; sources: { name: string; value: number }[] }[];
  pnlTimeline: RangePoint[];
  recentTransactions: Parameters<typeof TransactionList>[0]["items"];
  turnover: { steamUsdt: string; aurumUsdt: string; polyUsdt: string };
  totals: {
    availableCrypto: string;
    frozenTotalUsdt: string;
    cardUah: string;
    cashUah: string;
    cashUsd: string;
    savingsUah: string;
  };
};

const STRUCTURE_COLORS = ["#2563eb", "#16a34a", "#8b5cf6", "#d99b42", "#e8795f", "#0ea5e9", "#64748b", "#ec4899"];

/** Everything about the chosen period, under the bank on the home page. */
export function DashboardStatistics({ data }: { data: DashboardStatsData }) {
  const hidden = Boolean(data.settings?.hideAmounts);
  const rate = Number(data.rate);

  return (
    <section>
      <Card className="mt-4">
        <div className="mb-1 font-semibold">Накопичений результат</div>
        <div className="mb-3 text-sm text-[hsl(var(--card-muted-foreground))]">Чистий результат наростаючим підсумком: доходи мінус витрати і фліпи</div>
        <RangeAreaChart key={data.period.key} data={data.pnlTimeline} defaultPreset={chartPresetFor(data.period.key)} hidden={hidden} totalLabel="Всього" emptyLabel="Немає подій за період" />
      </Card>

      <Card className="mt-4">
        <div className="mb-1 font-semibold">Наростаючий дохід</div>
        <div className="mb-3 text-sm text-[hsl(var(--card-muted-foreground))]">Усі лінії та ліва шкала показані в USDT · {data.period.rangeLabel}</div>
        <IncomeLineChart data={data.incomeTimeline} rate={data.rate} hidden={hidden} />
        <div className="my-5 border-t border-border" />
        <div className="mb-1 font-semibold">Що приносить дохід</div>
        <div className="mb-3 text-sm text-[hsl(var(--card-muted-foreground))]">Наростаючий результат топ-5 напрямків у перерахунку на USDT</div>
        <IncomeSourceGrowthChart data={data.incomeSourceTimeline} hidden={hidden} />
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 font-semibold">Структура банку</div>
          <DonutBreakdown
            compact
            currency="USDT"
            hidden={hidden}
            emptyLabel="Поки порожньо"
            colors={STRUCTURE_COLORS}
            items={[
              { name: "Мейн гаманець", value: Number(data.totals.availableCrypto) },
              { name: "Steam", value: Number(data.turnover.steamUsdt) },
              { name: "Aurum", value: Number(data.turnover.aurumUsdt) },
              { name: "Polymarket", value: Number(data.turnover.polyUsdt) },
              { name: "Картка + готівка", value: (Number(data.totals.cardUah) + Number(data.totals.cashUah)) / rate + Number(data.totals.cashUsd) },
              { name: "Відкладення", value: Number(data.totals.savingsUah) / rate },
              { name: "Заморожено", value: Number(data.totals.frozenTotalUsdt) }
            ]}
          />
        </Card>
        <Card>
          <div className="mb-2 text-sm font-semibold">Останні операції</div>
          <TransactionList items={data.recentTransactions} compact />
        </Card>
      </div>
    </section>
  );
}
