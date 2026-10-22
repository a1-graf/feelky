"use client";

import { useId, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { niceRange, shortAxisValue, timeTicks, zeroOffset } from "@/lib/chart-scale";
import { formatMoney } from "@/lib/money";

/** One running-total series: `total` is the cumulative value at time `t`, `delta` what that event added. */
export type RangePoint = { t: number; total: number; delta: number; label?: string };

const PROFIT_COLOR = "#16a34a";
const LOSS_COLOR = "#e04d65";
const DAY = 86_400_000;
const AXIS_TICK = { fill: "hsl(var(--card-muted-foreground))", fontSize: 11 };
const KYIV = "Europe/Kyiv";

const PRESETS = [
  { key: "1w", label: "1W", span: 7 * DAY },
  { key: "1m", label: "1M", span: 30 * DAY },
  { key: "3m", label: "3M", span: 90 * DAY },
  { key: "6m", label: "6M", span: 180 * DAY },
  { key: "1y", label: "1Y", span: 365 * DAY },
  { key: "all", label: "ALL", span: 0 }
] as const;
type PresetKey = (typeof PRESETS)[number]["key"];

function formatTick(t: number, span: number) {
  const options: Intl.DateTimeFormatOptions = span <= 2 * DAY ? { hour: "2-digit", minute: "2-digit" } : { day: "2-digit", month: "2-digit" };
  return new Date(t).toLocaleString("uk-UA", { timeZone: KYIV, ...options });
}

function Tip({ active, payload, hidden, currency, totalLabel }: { active?: boolean; payload?: Array<{ payload: RangePoint }>; hidden: boolean; currency: string; totalLabel: string }) {
  const point = active ? payload?.[0]?.payload : undefined;
  if (!point) return null;
  const sign = (value: number) => (value > 0 ? "+" : "");
  return (
    <div className="rounded-md border border-border bg-card px-2 py-1 text-xs shadow">
      <div className="text-[hsl(var(--card-muted-foreground))]">{new Date(point.t).toLocaleString("uk-UA", { timeZone: KYIV, dateStyle: "short", timeStyle: "short" })}</div>
      <div className="font-semibold tabular-nums">
        {totalLabel} <span className={point.total > 0 ? "text-success" : point.total < 0 ? "text-danger" : undefined}>{hidden ? "••••" : `${sign(point.total)}${formatMoney(point.total.toFixed(2), currency)}`}</span>
      </div>
      {point.delta !== 0 && (
        <div className="text-[hsl(var(--card-muted-foreground))]">
          {point.label ? `${point.label} ` : ""}
          <span className={point.delta > 0 ? "text-success" : "text-danger"}>{hidden ? "••••" : `${sign(point.delta)}${point.delta.toFixed(2)}`}</span>
        </div>
      )}
    </div>
  );
}

/**
 * Polymarket-style area chart over a running series: value and its change on top, a Y axis with balances,
 * a time axis, window presets. `signed` paints the line green above zero and red below it; `color` fixes one
 * colour; otherwise the colour follows the trend. Shared by the home and income pages.
 */
export function RangeAreaChart({
  data,
  currency = "USDT",
  hidden = false,
  totalLabel = "Всього",
  emptyLabel = "Немає даних за період",
  defaultPreset = "1m",
  signed = false,
  color,
  showChange = true
}: {
  data: RangePoint[];
  currency?: string;
  hidden?: boolean;
  totalLabel?: string;
  emptyLabel?: string;
  defaultPreset?: PresetKey;
  signed?: boolean;
  color?: string;
  showChange?: boolean;
}) {
  const gradientId = useId().replace(/:/g, "");
  const [preset, setPreset] = useState<PresetKey>(defaultPreset);
  const [now] = useState(() => Date.now());

  const points = useMemo<RangePoint[]>(() => {
    if (!data.length) return [];
    const start = preset === "all" ? data[0].t : now - PRESETS.find((item) => item.key === preset)!.span;
    const before = [...data].reverse().find((point) => point.t < start);
    const inside = data.filter((point) => point.t >= start);
    if (!before && !inside.length) return [];
    const windowStart = before ? start : Math.max(start, inside[0].t);
    const startTotal = before ? before.total : (inside[0].total - inside[0].delta);
    const lastTotal = inside[inside.length - 1]?.total ?? startTotal;
    return [
      { t: windowStart, total: startTotal, delta: 0 },
      ...inside,
      { t: Math.max(now, inside[inside.length - 1]?.t ?? windowStart), total: lastTotal, delta: 0 }
    ];
  }, [data, preset, now]);

  const values = points.map((point) => point.total);
  const low = values.length ? Math.min(...values) : 0;
  const high = values.length ? Math.max(...values) : 0;
  const first = points[0];
  const last = points[points.length - 1];
  const change = first && last ? last.total - first.total : 0;
  const crossesZero = signed && low < 0;
  const lineColor = color ?? (signed ? (last && last.total < 0 ? LOSS_COLOR : PROFIT_COLOR) : change < 0 ? LOSS_COLOR : PROFIT_COLOR);
  const scale = niceRange(signed ? Math.min(low, 0) : low, signed ? Math.max(high, 0) : high);
  const xTicks = first && last ? timeTicks(first.t, last.t, 4) : [];
  const span = first && last ? last.t - first.t : 0;
  const strokeSplit = zeroOffset(low, high);
  const fillSplit = zeroOffset(Math.min(0, low), Math.max(0, high));
  const sign = (value: number) => (value > 0 ? "+" : "");
  const changeText = hidden ? "••••" : `${sign(change)}${formatMoney(change.toFixed(2), currency)}`;
  const percent = !signed && first && Math.abs(first.total) > 0.005 ? (change / Math.abs(first.total)) * 100 : null;

  return (
    <div className="flex min-h-56 flex-col">
      <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
        <div className="min-w-0">
          {last && (
            <>
              <div className="whitespace-nowrap text-xl font-bold leading-tight tabular-nums sm:text-2xl">{hidden ? "••••" : `${sign(last.total)}${formatMoney(last.total.toFixed(2), currency)}`}</div>
              {showChange && (
                <div className={`text-xs font-medium tabular-nums ${change > 0 ? "text-success" : change < 0 ? "text-danger" : "text-[hsl(var(--card-muted-foreground))]"}`}>
                  {changeText}
                  {percent != null && !hidden && ` (${sign(percent)}${percent.toFixed(1)}%)`}
                </div>
              )}
            </>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-0.5 sm:gap-1">
          {PRESETS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setPreset(item.key)}
              className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold leading-4 transition-colors ${preset === item.key ? "bg-foreground text-background" : "text-[hsl(var(--card-muted-foreground))] hover:text-foreground"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      {points.length < 2 ? (
        <div className="flex flex-1 items-center justify-center py-10 text-center text-sm text-[hsl(var(--card-muted-foreground))]">{emptyLabel}</div>
      ) : (
        <div className="relative mt-2 min-h-44 flex-1">
          <div className="absolute inset-0">
            <ResponsiveContainer>
              <AreaChart data={points} margin={{ left: 0, right: 8, top: 6, bottom: 0 }}>
                <defs>
                  <linearGradient id={`${gradientId}-fill`} x1="0" y1="0" x2="0" y2="1">
                    {crossesZero ? (
                      <>
                        <stop offset={0} stopColor={PROFIT_COLOR} stopOpacity={0.22} />
                        <stop offset={fillSplit} stopColor={PROFIT_COLOR} stopOpacity={0.04} />
                        <stop offset={fillSplit} stopColor={LOSS_COLOR} stopOpacity={0.04} />
                        <stop offset={1} stopColor={LOSS_COLOR} stopOpacity={0.22} />
                      </>
                    ) : (
                      <>
                        <stop offset={0} stopColor={lineColor} stopOpacity={0.28} />
                        <stop offset={1} stopColor={lineColor} stopOpacity={0.02} />
                      </>
                    )}
                  </linearGradient>
                  {crossesZero && (
                    <linearGradient id={`${gradientId}-stroke`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset={strokeSplit} stopColor={PROFIT_COLOR} />
                      <stop offset={strokeSplit} stopColor={LOSS_COLOR} />
                    </linearGradient>
                  )}
                </defs>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  type="number"
                  dataKey="t"
                  scale="time"
                  domain={[first.t, last.t]}
                  ticks={xTicks}
                  tickFormatter={(value) => formatTick(Number(value), span)}
                  tickLine={false}
                  axisLine={false}
                  tick={AXIS_TICK}
                  tickMargin={6}
                  interval={0}
                  padding={{ left: 8, right: 8 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={AXIS_TICK}
                  tickFormatter={(value) => (hidden ? "••" : shortAxisValue(Number(value)))}
                  domain={scale.domain}
                  ticks={scale.ticks}
                  interval={0}
                  width={44}
                />
                <Tooltip content={<Tip hidden={hidden} currency={currency} totalLabel={totalLabel} />} cursor={{ stroke: "hsl(var(--foreground) / 0.3)" }} />
                {signed && scale.domain[0] < 0 && <ReferenceLine y={0} stroke="hsl(var(--foreground) / 0.3)" />}
                <Area
                  type="monotone"
                  dataKey="total"
                  baseValue={signed ? 0 : scale.domain[0]}
                  stroke={crossesZero ? `url(#${gradientId}-stroke)` : lineColor}
                  strokeWidth={2.5}
                  fill={`url(#${gradientId}-fill)`}
                  isAnimationActive={false}
                  dot={false}
                  activeDot={{ r: 4, fill: lineColor, stroke: "hsl(var(--card))", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
