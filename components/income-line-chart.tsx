"use client";

import { useMemo } from "react";
import { Bar, CartesianGrid, Cell, ComposedChart, Line, LineChart, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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

type LossBreakdownItem = {
  name: string;
  value: string;
};

const SOURCE_COLORS = ["#2563eb", "#e8795f", "#16a34a", "#d99b42", "#8b5cf6"];
const LOSS_COLORS = ["#e04d65", "#e8795f", "#d99b42", "#b7845b", "#8b5cf6", "#5d8aa8", "#4d9a78", "#6d7f98"];

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

type PnlTooltipPoint = PnlTimelinePoint & { dayNet: number };

function PnlTooltip({ active, payload, hidden }: { active?: boolean; payload?: Array<{ payload: PnlTooltipPoint }>; hidden: boolean }) {
  const point = active ? payload?.[0]?.payload : undefined;
  if (!point) return null;
  const rows: Array<[string, number, string]> = [
    ["Плюс", point.profit, "#16a34a"],
    ["Мінус", -point.loss, "#e04d65"],
    ["Разом за день", point.dayNet, point.dayNet >= 0 ? "#16a34a" : "#e04d65"],
    ["Накопичено", point.net, "#2563eb"]
  ];
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-soft">
      <div className="mb-1 font-semibold text-[hsl(var(--card-foreground))]">{point.label}</div>
      {rows.map(([label, value, color]) => (
        <div key={label} className="flex items-center justify-between gap-4">
          <span className="text-[hsl(var(--card-muted-foreground))]">{label}</span>
          <span style={{ color }}>{formatMoney(value, "USDT", hidden)}</span>
        </div>
      ))}
    </div>
  );
}

export function NetPnlChart({ data, hidden = false }: { data: PnlTimelinePoint[]; hidden?: boolean }) {
  const sortedData = useMemo<PnlTooltipPoint[]>(
    () => [...data]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((point) => ({ ...point, dayNet: point.profit - point.loss })),
    [data]
  );
  const latest = sortedData[sortedData.length - 1];
  const totals = useMemo(
    () => sortedData.reduce(
      (result, point) => ({ profit: result.profit + point.profit, loss: result.loss + point.loss }),
      { profit: 0, loss: 0 }
    ),
    [sortedData]
  );

  if (!latest) {
    return <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border text-sm text-[hsl(var(--card-muted-foreground))]">Поки немає PnL</div>;
  }

  const showDots = sortedData.length <= 100;
  const netColor = latest.net >= 0 ? "#16a34a" : "#e04d65";
  const includeZero = ([min, max]: [number, number]): [number, number] => [Math.min(0, min), Math.max(0, max)];

  return (
    <div>
      {/* Period summary chips */}
      <div className="mb-4 grid grid-cols-3 gap-2 sm:gap-3">
        <div className="rounded-xl border border-border bg-muted/40 px-3 py-2.5">
          <div className="text-[11px] font-medium uppercase tracking-wide text-[hsl(var(--card-muted-foreground))]">Плюси</div>
          <div className="mt-0.5 break-words text-sm font-bold text-success sm:text-base">{formatMoney(totals.profit, "USDT", hidden)}</div>
        </div>
        <div className="rounded-xl border border-border bg-muted/40 px-3 py-2.5">
          <div className="text-[11px] font-medium uppercase tracking-wide text-[hsl(var(--card-muted-foreground))]">Мінуси</div>
          <div className="mt-0.5 break-words text-sm font-bold text-danger sm:text-base">{formatMoney(-totals.loss, "USDT", hidden)}</div>
        </div>
        <div className="rounded-xl border border-border bg-muted/40 px-3 py-2.5">
          <div className="text-[11px] font-medium uppercase tracking-wide text-[hsl(var(--card-muted-foreground))]">Чистий PnL</div>
          <div className={`mt-0.5 break-words text-sm font-bold sm:text-base ${latest.net >= 0 ? "text-success" : "text-danger"}`}>
            {formatMoney(latest.net, "USDT", hidden)}
          </div>
        </div>
      </div>

      {/* 1. Per-day results: green bars up, red bars down from the zero line */}
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <div className="text-sm font-medium">Результат кожного дня</div>
        <div className="flex gap-3 text-xs text-[hsl(var(--card-muted-foreground))]">
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-success" />прибуток</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-danger" />збиток</span>
        </div>
      </div>
      <div className="h-52 w-full">
        <ResponsiveContainer>
          <ComposedChart data={sortedData} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--card-muted-foreground))", fontSize: 12 }} interval="preserveStartEnd" />
            <YAxis
              yAxisId="daily"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "hsl(var(--card-muted-foreground))", fontSize: 12 }}
              tickFormatter={(value) => axisValue(Number(value), hidden)}
              domain={includeZero}
              width={58}
            />
            <Tooltip content={<PnlTooltip hidden={hidden} />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} />
            <ReferenceLine yAxisId="daily" y={0} stroke="hsl(var(--foreground) / 0.35)" strokeWidth={1.5} />
            <Bar yAxisId="daily" dataKey="dayNet" name="Разом за день" maxBarSize={26} radius={[3, 3, 3, 3]} isAnimationActive={false}>
              {sortedData.map((point) => (
                <Cell key={point.date} fill={point.dayNet >= 0 ? "#16a34a" : "#e04d65"} />
              ))}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* 2. Running total: a single clean line, colored by the final result */}
      <div className="mb-1.5 mt-6 flex items-baseline justify-between gap-3">
        <div className="text-sm font-medium">Накопичений результат</div>
        <div className="text-xs text-[hsl(var(--card-muted-foreground))]">як змінювався PnL з початку періоду</div>
      </div>
      <div className="h-52 w-full">
        <ResponsiveContainer>
          <LineChart data={sortedData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--card-muted-foreground))", fontSize: 12 }} interval="preserveStartEnd" />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: "hsl(var(--card-muted-foreground))", fontSize: 12 }}
              tickFormatter={(value) => axisValue(Number(value), hidden)}
              domain={includeZero}
              width={58}
            />
            <Tooltip content={<PnlTooltip hidden={hidden} />} cursor={{ stroke: "hsl(var(--border))" }} />
            <ReferenceLine y={0} stroke="hsl(var(--foreground) / 0.35)" strokeWidth={1.5} />
            <Line type="monotone" dataKey="net" name="Накопичено" stroke={netColor} strokeWidth={3} isAnimationActive={false} dot={showDots ? { r: 3.5, fill: netColor, strokeWidth: 0 } : false} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function LossBreakdownChart({ data, hidden = false }: { data: LossBreakdownItem[]; hidden?: boolean }) {
  const chartData = useMemo(
    () => data.map((item, index) => ({ name: item.name, value: Number(item.value), color: LOSS_COLORS[index % LOSS_COLORS.length] })).filter((item) => item.value > 0).slice(0, 8),
    [data]
  );
  const total = chartData.reduce((sum, item) => sum + item.value, 0);

  if (!chartData.length || total <= 0) {
    return <div className="flex h-52 items-center justify-center rounded-lg border border-dashed border-border text-sm text-[hsl(var(--card-muted-foreground))]">Поки немає мінусів</div>;
  }

  return (
    <div>
      <div className="mb-2 text-sm text-[hsl(var(--card-muted-foreground))]">
        Загалом мінусів: <span className="font-semibold text-[hsl(var(--card-foreground))]">{formatMoney(total, "USDT", hidden)}</span>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center">
        <div className="h-72 min-w-0">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={chartData} dataKey="value" nameKey="name" innerRadius="54%" outerRadius="82%" paddingAngle={3} stroke="hsl(var(--card))" strokeWidth={4}>
                {chartData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value, name) => [formatMoney(Number(value), "USDT", hidden), name]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="grid gap-2">
          {chartData.map((item) => (
            <div key={item.name} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="truncate">{item.name}</span>
              </span>
              <span className="shrink-0 font-semibold">{hidden ? "****" : `${Math.round((item.value / total) * 100)}%`}</span>
            </div>
          ))}
        </div>
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
