"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney } from "@/lib/money";

type BalancePoint = {
  date: string;
  label: string;
  tooltipLabel?: string;
  eventIndex?: number;
  full: number;
  available: number;
};

const ranges = [
  { label: "7д", days: 7 },
  { label: "1м", days: 30 },
  { label: "3м", days: 90 },
  { label: "6м", days: 180 },
  { label: "12м", days: 365 },
  { label: "Все", days: null }
];

export function BalanceGrowthChart({ data, rate, hidden = false }: { data: BalancePoint[]; rate: string; hidden?: boolean }) {
  const [rangeDays, setRangeDays] = useState<number | null>(30);
  const uahRate = Number(rate);
  const visibleData = useMemo(() => {
    const sorted = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    if (!rangeDays || sorted.length <= 1) return sorted;

    const endDate = new Date();
    const cutoff = new Date(endDate);
    cutoff.setDate(cutoff.getDate() - rangeDays);
    const firstInRangeIndex = sorted.findIndex((point) => new Date(point.date).getTime() >= cutoff.getTime());

    if (firstInRangeIndex === 0) return sorted;
    if (firstInRangeIndex === -1) {
      const previous = sorted[sorted.length - 1];
      return [
        { ...previous, date: cutoff.toISOString(), label: "Старт", tooltipLabel: "Початок періоду", eventIndex: 0 },
        { ...previous, date: endDate.toISOString(), label: "Зараз", tooltipLabel: "Зараз", eventIndex: 1 }
      ];
    }

    const previous = sorted[firstInRangeIndex - 1];
    return [
      { ...previous, date: cutoff.toISOString(), label: "Старт", tooltipLabel: "Початок періоду", eventIndex: 0 },
      ...sorted.slice(firstInRangeIndex)
    ];
  }, [data, rangeDays]);
  const yDomain = useMemo<[number, number]>(() => {
    const values = visibleData.flatMap((point) => [point.full, point.available]).filter(Number.isFinite);
    if (!values.length) return [0, 1000];
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    const observedSpan = maximum - minimum;
    const padding = Math.max(600, maximum * 0.55, observedSpan * 0.8);
    const roughMinimum = Math.max(0, minimum - padding);
    const roughMaximum = maximum + padding;
    const rounding = roughMaximum >= 10000 ? 1000 : roughMaximum >= 2000 ? 500 : 100;
    return [
      Math.max(0, Math.floor(roughMinimum / rounding) * rounding),
      Math.ceil(roughMaximum / rounding) * rounding
    ];
  }, [visibleData]);

  if (!data.length) {
    return <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border text-sm text-[hsl(var(--card-muted-foreground))]">Поки немає даних</div>;
  }

  const showDots = visibleData.length <= 120;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-[hsl(var(--card-muted-foreground))]">
          <span className="inline-flex items-center gap-2">
            <span className="h-0.5 w-8 rounded-full bg-[#2563eb]" />
            Повний
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-0.5 w-8 rounded-full bg-[#16a34a]" />
            Доступний + в обороті
          </span>
        </div>
        <div className="inline-flex overflow-hidden rounded-lg border border-border bg-muted p-1">
          {ranges.map((range) => (
            <button
              key={range.label}
              type="button"
              className={`min-h-8 rounded-md px-3 text-xs font-semibold transition ${rangeDays === range.days ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-card"}`}
              onClick={() => setRangeDays(range.days)}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>
      <div className="h-80 w-full">
        <ResponsiveContainer>
          <LineChart data={visibleData} margin={{ left: 0, right: 8, top: 24, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--card-muted-foreground))", fontSize: 12 }} interval="preserveStartEnd" />
            <YAxis
              domain={yDomain}
              allowDataOverflow
              tickCount={6}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "hsl(var(--card-muted-foreground))", fontSize: 12 }}
              tickFormatter={(value) => hidden ? "****" : new Intl.NumberFormat("uk-UA", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value))}
              width={56}
            />
            <Tooltip
              formatter={(value, name) => {
                const amount = Number(value);
                return [`${formatMoney(amount, "USDT", hidden)} · ${formatMoney(amount * uahRate, "UAH", hidden)}`, name === "full" ? "Повний" : "Доступний + в обороті"];
              }}
              labelFormatter={(_, payload) => `Дата: ${payload?.[0]?.payload?.tooltipLabel || payload?.[0]?.payload?.label || ""}`}
            />
            <Line type="linear" dataKey="full" name="full" stroke="#2563eb" strokeWidth={2.5} dot={showDots ? { r: 3 } : false} activeDot={{ r: 5 }} />
            <Line type="linear" dataKey="available" name="available" stroke="#16a34a" strokeWidth={2.5} dot={showDots ? { r: 3 } : false} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
