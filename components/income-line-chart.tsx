"use client";

import { useId, useMemo } from "react";
import { Area, Bar, CartesianGrid, Cell, ComposedChart, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DonutBreakdown } from "@/components/donut-breakdown";
import { calendarDays, dayLabel, niceScale, shortAxisValue, zeroOffset } from "@/lib/chart-scale";
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

const SOURCE_COLORS = ["#2563eb", "#e8795f", "#16a34a", "#d99b42", "#8b5cf6", "#0ea5e9"];
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
    // Biggest by size, not by sign: a losing source matters as much as a winning one.
    const series = Array.from(totals.entries())
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
      .slice(0, SOURCE_COLORS.length)
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
    const scale = niceScale(points.flatMap((point) => series.map((item) => Number(point[item.key]))));
    return { series, points, scale, largest: Math.max(...series.map((item) => Math.abs(item.total)), 0) };
  }, [data]);

  if (!prepared.series.length) return null;
  const showDots = prepared.points.length <= 100;
  const signed = (value: number) => (hidden ? "••••" : `${value > 0 ? "+" : ""}${formatMoney(value.toFixed(2), "USDT")}`);
  return (
    <div>
      <ul className="mb-4 space-y-2">
        {prepared.series.map((item) => {
          const width = prepared.largest > 0 ? (Math.abs(item.total) / prepared.largest) * 50 : 0;
          return (
            <li key={item.key} className="grid grid-cols-[minmax(0,7.5rem)_1fr_auto] items-center gap-2 text-sm sm:grid-cols-[minmax(0,10rem)_1fr_auto]">
              <span className="flex min-w-0 items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="truncate">{item.name}</span>
              </span>
              <span className="relative h-2 rounded-full bg-muted">
                <span className="absolute inset-y-0 left-1/2 w-px bg-[hsl(var(--foreground)/0.3)]" />
                <span
                  className="absolute inset-y-0 rounded-full"
                  style={{ backgroundColor: item.total >= 0 ? PROFIT_COLOR : LOSS_COLOR, width: `${Math.max(width, 1)}%`, ...(item.total >= 0 ? { left: "50%" } : { right: "50%" }) }}
                />
              </span>
              <span className={`text-right font-semibold tabular-nums ${item.total > 0 ? "text-success" : item.total < 0 ? "text-danger" : ""}`}>{signed(item.total)}</span>
            </li>
          );
        })}
      </ul>
      <div className="h-64 w-full">
        <ResponsiveContainer>
          <LineChart data={prepared.points} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--card-muted-foreground))", fontSize: 12 }} interval="preserveStartEnd" />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--card-muted-foreground))", fontSize: 12 }} tickFormatter={(value) => (hidden ? "••" : shortAxisValue(Number(value)))} domain={prepared.scale.domain} ticks={prepared.scale.ticks} interval={0} width={48} />
            <Tooltip formatter={(value, name) => [signed(Number(value)), name]} labelFormatter={(label) => `Дата: ${label}`} />
            <ReferenceLine y={0} stroke="hsl(var(--foreground) / 0.3)" />
            {prepared.series.map((item) => (
              <Line key={item.key} type="monotone" dataKey={item.key} name={item.name} stroke={item.color} strokeWidth={2.5} dot={showDots ? { r: 2.5 } : false} activeDot={{ r: 5 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

type PnlDay = PnlTimelinePoint & { dayNet: number; active: boolean };

const PROFIT_COLOR = "#16a34a";
const LOSS_COLOR = "#e04d65";
// Both PnL charts share these, so a day's bar sits exactly above its point on the running total.
const PNL_MARGIN = { left: 0, right: 4, top: 8, bottom: 0 };
const PNL_AXIS_WIDTH = 48;
const PNL_AXIS_TICK = { fill: "hsl(var(--card-muted-foreground))", fontSize: 12 };

function PnlTooltip({ active, payload, hidden, currency = "USDT" }: { active?: boolean; payload?: Array<{ payload: PnlDay }>; hidden: boolean; currency?: string }) {
  const point = active ? payload?.[0]?.payload : undefined;
  if (!point) return null;
  const rows: Array<[string, number, string]> = point.active
    ? [
        ["Плюс", point.profit, PROFIT_COLOR],
        ["Мінус", -point.loss, LOSS_COLOR],
        ["Разом за день", point.dayNet, point.dayNet >= 0 ? PROFIT_COLOR : LOSS_COLOR],
        ["Накопичено", point.net, point.net >= 0 ? PROFIT_COLOR : LOSS_COLOR]
      ]
    : [["Накопичено", point.net, point.net >= 0 ? PROFIT_COLOR : LOSS_COLOR]];
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-soft">
      <div className="mb-1 font-semibold text-[hsl(var(--card-foreground))]">{point.label}</div>
      {!point.active && <div className="text-[hsl(var(--card-muted-foreground))]">Без операцій</div>}
      {rows.map(([label, value, color]) => (
        <div key={label} className="flex items-center justify-between gap-4">
          <span className="text-[hsl(var(--card-muted-foreground))]">{label}</span>
          <span className="tabular-nums" style={{ color }}>{formatMoney(value.toFixed(2), currency, hidden)}</span>
        </div>
      ))}
    </div>
  );
}

function PnlChip({ label, value, className }: { label: string; value: string; className: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/40 px-3 py-2.5">
      <div className="text-[10px] font-medium uppercase text-[hsl(var(--card-muted-foreground))] sm:text-[11px] sm:tracking-wide">{label}</div>
      <div className={`mt-0.5 break-words text-sm font-bold tabular-nums sm:text-base ${className}`}>{value}</div>
    </div>
  );
}

export function NetPnlChart({
  data,
  hidden = false,
  currency = "USDT",
  from,
  to,
  cumulativeOnly = false
}: {
  data: PnlTimelinePoint[];
  hidden?: boolean;
  currency?: string;
  /** First and last day of the period (YYYY-MM-DD) so quiet days still take their place on the axis. */
  from?: string;
  to?: string;
  cumulativeOnly?: boolean;
}) {
  const gradientId = useId().replace(/:/g, "");
  const days = useMemo<PnlDay[]>(() => {
    const byDate = new Map(data.map((point) => [point.date, point]));
    let running = 0;
    return calendarDays(data.map((point) => point.date), from, to).map((date) => {
      const point = byDate.get(date);
      const profit = point?.profit ?? 0;
      const loss = point?.loss ?? 0;
      running += profit - loss;
      return { date, label: point?.label ?? dayLabel(date), profit, loss, dayNet: profit - loss, net: running, active: Boolean(point) };
    });
  }, [data, from, to]);

  if (!data.length || !days.length) {
    return <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border text-sm text-[hsl(var(--card-muted-foreground))]">Поки немає PnL</div>;
  }

  const totalProfit = days.reduce((sum, day) => sum + day.profit, 0);
  const totalLoss = days.reduce((sum, day) => sum + day.loss, 0);
  const latestNet = days[days.length - 1].net;
  const dailyScale = niceScale(days.map((day) => day.dayNet));
  const netScale = niceScale(days.map((day) => day.net));
  // Label every n-th day so the dates are spread evenly and never collide on a phone.
  const labelInterval = Math.ceil(days.length / 7) - 1;
  const tickFormatter = (value: number) => (hidden ? "••" : shortAxisValue(value));

  const netValues = days.map((day) => day.net);
  const netLow = Math.min(...netValues);
  const netHigh = Math.max(...netValues);
  const fillSplit = zeroOffset(Math.min(0, netLow), Math.max(0, netHigh));
  const strokeSplit = zeroOffset(netLow, netHigh);
  // A flat line has a zero-height box, and a gradient on it would not paint at all.
  const netStroke = netLow === netHigh ? (netLow >= 0 ? PROFIT_COLOR : LOSS_COLOR) : `url(#${gradientId}-stroke)`;

  const xAxis = (
    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={PNL_AXIS_TICK} interval={labelInterval} tickMargin={6} />
  );

  return (
    <div>
      {!cumulativeOnly && (
        <>
          <div className="mb-5 grid grid-cols-3 gap-2 sm:gap-3">
            <PnlChip label="Плюси" value={formatMoney(totalProfit.toFixed(2), currency, hidden)} className="text-success" />
            <PnlChip label="Мінуси" value={formatMoney((-totalLoss).toFixed(2), currency, hidden)} className="text-danger" />
            <PnlChip label="Чистий PnL" value={formatMoney(latestNet.toFixed(2), currency, hidden)} className={latestNet >= 0 ? "text-success" : "text-danger"} />
          </div>

          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="text-sm font-medium">Результат кожного дня</div>
            <div className="flex gap-3 text-xs text-[hsl(var(--card-muted-foreground))]">
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-success" />плюс</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-danger" />мінус</span>
            </div>
          </div>
          <div className="h-48 w-full">
            <ResponsiveContainer>
              <ComposedChart data={days} margin={PNL_MARGIN} barCategoryGap="24%">
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                {xAxis}
                <YAxis tickLine={false} axisLine={false} tick={PNL_AXIS_TICK} tickFormatter={tickFormatter} domain={dailyScale.domain} ticks={dailyScale.ticks} interval={0} width={PNL_AXIS_WIDTH} />
                <Tooltip content={<PnlTooltip hidden={hidden} currency={currency} />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }} />
                <ReferenceLine y={0} stroke="hsl(var(--foreground) / 0.3)" />
                <Bar dataKey="dayNet" maxBarSize={28} radius={[4, 4, 4, 4]} isAnimationActive={false}>
                  {days.map((day) => (
                    <Cell key={day.date} fill={day.dayNet >= 0 ? PROFIT_COLOR : LOSS_COLOR} />
                  ))}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {!cumulativeOnly && (
        <div className="mb-2 mt-6 flex items-center justify-between gap-3">
          <div className="text-sm font-medium">Накопичений результат</div>
          <div className="text-xs text-[hsl(var(--card-muted-foreground))]">з початку періоду</div>
        </div>
      )}
      <div className="h-48 w-full">
        <ResponsiveContainer>
          <ComposedChart data={days} margin={PNL_MARGIN}>
            <defs>
              <linearGradient id={`${gradientId}-fill`} x1="0" y1="0" x2="0" y2="1">
                <stop offset={0} stopColor={PROFIT_COLOR} stopOpacity={0.22} />
                <stop offset={fillSplit} stopColor={PROFIT_COLOR} stopOpacity={0.06} />
                <stop offset={fillSplit} stopColor={LOSS_COLOR} stopOpacity={0.06} />
                <stop offset={1} stopColor={LOSS_COLOR} stopOpacity={0.22} />
              </linearGradient>
              <linearGradient id={`${gradientId}-stroke`} x1="0" y1="0" x2="0" y2="1">
                <stop offset={strokeSplit} stopColor={PROFIT_COLOR} />
                <stop offset={strokeSplit} stopColor={LOSS_COLOR} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
            {xAxis}
            <YAxis tickLine={false} axisLine={false} tick={PNL_AXIS_TICK} tickFormatter={tickFormatter} domain={netScale.domain} ticks={netScale.ticks} interval={0} width={PNL_AXIS_WIDTH} />
            <Tooltip content={<PnlTooltip hidden={hidden} currency={currency} />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }} />
            <ReferenceLine y={0} stroke="hsl(var(--foreground) / 0.3)" />
            {/* Invisible bars give this chart the same day slots as the one above, so the points sit under the bars. */}
            <Bar dataKey="net" fill="transparent" isAnimationActive={false} />
            <Area
              type="linear"
              dataKey="net"
              baseValue={0}
              stroke={netStroke}
              strokeWidth={2.5}
              fill={`url(#${gradientId}-fill)`}
              isAnimationActive={false}
              dot={(props: { cx?: number; cy?: number; index?: number; payload?: PnlDay }) =>
                props.payload?.active && props.cx != null && props.cy != null
                  ? <circle key={`dot-${props.index}`} cx={props.cx} cy={props.cy} r={3.5} fill={props.payload.net >= 0 ? PROFIT_COLOR : LOSS_COLOR} stroke="hsl(var(--card))" strokeWidth={1.5} />
                  : <g key={`dot-${props.index}`} />
              }
              activeDot={(props: { cx?: number; cy?: number; payload?: PnlDay }) => (
                <circle cx={props.cx} cy={props.cy} r={5} fill={(props.payload?.net ?? 0) >= 0 ? PROFIT_COLOR : LOSS_COLOR} stroke="hsl(var(--card))" strokeWidth={2} />
              )}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const LOSS_COLORS = ["#e04d65", "#e8795f", "#d99b42", "#b7845b", "#8b5cf6", "#5d8aa8", "#4d9a78", "#6d7f98"];

export function LossBreakdownChart({ data, hidden = false }: { data: LossBreakdownItem[]; hidden?: boolean }) {
  const items = useMemo(() => data.map((item) => ({ name: item.name, value: Number(item.value) })), [data]);
  return <DonutBreakdown items={items} colors={LOSS_COLORS} currency="USDT" hidden={hidden} totalLabel="Мінусів" emptyLabel="Поки немає мінусів" />;
}

function ChartTotal({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-0.5 w-8" style={{ backgroundColor: color }} />
      <span>{label}: <b className="text-[hsl(var(--card-foreground))]">{value}</b></span>
    </span>
  );
}
