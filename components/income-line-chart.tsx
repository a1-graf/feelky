"use client";

import { useMemo } from "react";
import { Bar, CartesianGrid, ComposedChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney } from "@/lib/money";

type IncomeTimelinePoint = {
  date: string;
  label: string;
  usdt: number;
  uah: number;
};

type IncomeSourceTimelinePoint = {
  date: string;
  label: string;
  sources: { name: string; value: number }[];
};

type PnlTimelinePoint = {
  date: string;
  label: string;
  profit: number;
  loss: number;
  net: number;
};

const SOURCE_COLORS = ["#2563eb", "#e8795f", "#16a34a", "#d99b42", "#8b5cf6"];

function axisValue(value: number, hidden: boolean) {
  if (hidden) return "****";
  return new Intl.NumberFormat("uk-UA", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function IncomeLineChart({ data, rate, hidden = false }: { data: IncomeTimelinePoint[]; rate: string; hidden?: boolean }) {
  const uahRate = Number(rate);
  const cumulativeData = useMemo(() => {
    let usdt = 0;
    let uahUsdt = 0;
    return [...data]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((point) => {
        usdt += point.usdt;
        uahUsdt += point.uah / uahRate;
        return { ...point, usdt, uahUsdt, totalUsdt: usdt + uahUsdt };
      });
  }, [data, uahRate]);
  const latest = cumulativeData[cumulativeData.length - 1];

  if (!latest || (!latest.usdt && !latest.uahUsdt)) {
    return <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border text-sm text-[hsl(var(--card-muted-foreground))]">Поки немає доходів</div>;
  }

  const showDots = cumulativeData.length <= 100;
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[hsl(var(--card-muted-foreground))]">
        <ChartTotal color="#2563eb" label="USDT" value={formatMoney(latest.usdt, "USDT", hidden)} />
        <ChartTotal color="#e8795f" label="UAH → USDT" value={formatMoney(latest.uahUsdt, "USDT", hidden)} />
        <ChartTotal color="#16a34a" label="Загальний" value={formatMoney(latest.totalUsdt, "USDT", hidden)} />
      </div>
      <div className="h-80 w-full">
        <ResponsiveContainer>
          <LineChart data={cumulativeData} margin={{ left: 0, right: 8, top: 16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--card-muted-foreground))", fontSize: 12 }} interval="preserveStartEnd" />
            <YAxis
              yAxisId="usdt"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "hsl(var(--card-muted-foreground))", fontSize: 12 }}
              tickFormatter={(value) => axisValue(Number(value), hidden)}
              width={62}
            />
            <Tooltip
              formatter={(value, name) => [
                formatMoney(Number(value), "USDT", hidden),
                name === "TOTAL" ? "Загальний дохід" : name
              ]}
              labelFormatter={(label) => `Дата: ${label}`}
            />
            <Line yAxisId="usdt" type="monotone" dataKey="usdt" name="USDT" stroke="#2563eb" strokeWidth={2.5} dot={showDots ? { r: 3 } : false} activeDot={{ r: 5 }} />
            <Line yAxisId="usdt" type="monotone" dataKey="uahUsdt" name="UAH → USDT" stroke="#e8795f" strokeWidth={2.5} dot={showDots ? { r: 3 } : false} activeDot={{ r: 5 }} />
            <Line yAxisId="usdt" type="monotone" dataKey="totalUsdt" name="TOTAL" stroke="#16a34a" strokeWidth={3.5} dot={showDots ? { r: 3.5 } : false} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function IncomeSourceGrowthChart({ data, hidden = false }: { data: IncomeSourceTimelinePoint[]; hidden?: boolean }) {
  const prepared = useMemo(() => {
    const totals = new Map<string, number>();
    for (const point of data) {
      for (const source of point.sources) totals.set(source.name, (totals.get(source.name) || 0) + source.value);
    }
    const series = Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, total], index) => ({ name, total, key: `source${index}`, color: SOURCE_COLORS[index] }));
    const running = new Map<string, number>();
    const points = [...data]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((point) => {
        for (const source of point.sources) running.set(source.name, (running.get(source.name) || 0) + source.value);
        const chartPoint: Record<string, string | number> = { date: point.date, label: point.label };
        for (const item of series) chartPoint[item.key] = running.get(item.name) || 0;
        return chartPoint;
      });
    return { series, points };
  }, [data]);

  if (!prepared.series.length) return null;
  const showDots = prepared.points.length <= 100;
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[hsl(var(--card-muted-foreground))]">
        {prepared.series.map((item) => (
          <ChartTotal key={item.key} color={item.color} label={item.name} value={formatMoney(item.total, "USDT", hidden)} />
        ))}
      </div>
      <div className="h-72 w-full">
        <ResponsiveContainer>
          <LineChart data={prepared.points} margin={{ left: 0, right: 8, top: 16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--card-muted-foreground))", fontSize: 12 }} interval="preserveStartEnd" />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--card-muted-foreground))", fontSize: 12 }} tickFormatter={(value) => axisValue(Number(value), hidden)} width={54} />
            <Tooltip formatter={(value, name) => [formatMoney(Number(value), "USDT", hidden), name]} labelFormatter={(label) => `Дата: ${label}`} />
            {prepared.series.map((item) => (
              <Line key={item.key} type="monotone" dataKey={item.key} name={item.name} stroke={item.color} strokeWidth={2.5} dot={showDots ? { r: 3 } : false} activeDot={{ r: 5 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function NetPnlChart({ data, hidden = false }: { data: PnlTimelinePoint[]; hidden?: boolean }) {
  const sortedData = useMemo(() => [...data].sort((a, b) => a.date.localeCompare(b.date)).map((point) => ({ ...point, lossBar: -point.loss })), [data]);
  const latest = sortedData[sortedData.length - 1];

  if (!latest) {
    return <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border text-sm text-[hsl(var(--card-muted-foreground))]">Поки немає PnL</div>;
  }

  const showDots = sortedData.length <= 100;
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[hsl(var(--card-muted-foreground))]">
        <ChartTotal color="#16a34a" label="Плюси" value={formatMoney(latest.profit, "USDT", hidden)} />
        <ChartTotal color="#e04d65" label="Мінуси" value={formatMoney(latest.loss, "USDT", hidden)} />
        <ChartTotal color="#2563eb" label="Чистий PnL" value={formatMoney(latest.net, "USDT", hidden)} />
      </div>
      <div className="h-72 w-full">
        <ResponsiveContainer>
          <ComposedChart data={sortedData} margin={{ left: 0, right: 8, top: 16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--card-muted-foreground))", fontSize: 12 }} interval="preserveStartEnd" />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--card-muted-foreground))", fontSize: 12 }} tickFormatter={(value) => axisValue(Number(value), hidden)} width={62} />
            <Tooltip
              formatter={(value, name, item) => {
                const key = item.dataKey;
                const label = key === "net" ? "Чистий PnL" : key === "profit" ? "Плюси" : "Мінуси";
                const amount = key === "lossBar" ? Math.abs(Number(value)) : Number(value);
                return [formatMoney(amount, "USDT", hidden), label];
              }}
              labelFormatter={(label) => `Дата: ${label}`}
            />
            <Bar dataKey="profit" name="Плюси" fill="#16a34a" radius={[4, 4, 0, 0]} maxBarSize={34} />
            <Bar dataKey="lossBar" name="Мінуси" fill="#e04d65" radius={[0, 0, 4, 4]} maxBarSize={34} />
            <Line type="monotone" dataKey="net" name="Чистий PnL" stroke="#2563eb" strokeWidth={3.5} dot={showDots ? { r: 3.5 } : false} activeDot={{ r: 6 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ChartTotal({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-0.5 w-8" style={{ backgroundColor: color }} />
      <span>{label}: <b className="text-[hsl(var(--card-foreground))]">{value}</b></span>
    </span>
  );
}
