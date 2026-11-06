// ARCHIVE (06.11.2026): «Наростаючий дохід» і «Що приносить дохід» з головної варіанта B. Замінено графіком components/home/flow-chart.tsx і кільцями components/home/flow-donut.tsx.
// Щоб повернути: у components/home/gpt-home.tsx відрендерити <IncomeCharts data={data} hidden={hidden} /> з цього файла.
import { IncomeLineChart, IncomeSourceGrowthChart } from "@/components/income-line-chart";
import { Card } from "@/components/ui/card";

type IncomeChartsData = {
  period: { rangeLabel: string };
  rate: string;
  incomeTimeline: { date: string; label: string; usdt: number; uah: number }[];
  incomeSourceTimeline: { date: string; label: string; sources: { name: string; value: number }[] }[];
};

/** Growing income and what brings it in, for the chosen period. */
export function IncomeCharts({ data, hidden }: { data: IncomeChartsData; hidden: boolean }) {
  return (
    <Card className="mt-4">
      <div className="mb-1 font-semibold">Наростаючий дохід</div>
      <div className="mb-3 text-sm text-[hsl(var(--card-muted-foreground))]">Усі лінії та ліва шкала показані в USDT · {data.period.rangeLabel}</div>
      <IncomeLineChart data={data.incomeTimeline} rate={data.rate} hidden={hidden} />
      <div className="my-5 border-t border-border" />
      <div className="mb-1 font-semibold">Що приносить дохід</div>
      <div className="mb-3 text-sm text-[hsl(var(--card-muted-foreground))]">Результат напрямків за період, USDT: Poly і Aurum — підсумок дня, мінуси теж видно</div>
      <IncomeSourceGrowthChart data={data.incomeSourceTimeline} hidden={hidden} />
    </Card>
  );
}
