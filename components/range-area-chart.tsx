"use client";

import { useId, useMemo, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import { formatMoney } from "@/lib/money";

/** One running-total series: `total` is the cumulative value at time `t`, `delta` what that event added. */
export type RangePoint = { t: number; total: number; delta: number; label?: string };

const PROFIT_COLOR = "#16a34a";
const LOSS_COLOR = "#e04d65";
const DAY = 86_400_000;

const PRESETS = [
  { key: "1w", label: "1W", span: 7 * DAY },
  { key: "1m", label: "1M", span: 30 * DAY },
  { key: "3m", label: "3M", span: 90 * DAY },
  { key: "6m", label: "6M", span: 180 * DAY },
  { key: "1y", label: "1Y", span: 365 * DAY },
  { key: "all", label: "ALL", span: 0 }
] as const;
type PresetKey = (typeof PRESETS)[number]["key"];

function Tip({ active, payload, hidden, currency, totalLabel }: { active?: boolean; payload?: Array<{ payload: RangePoint }>; hidden: boolean; currency: string; totalLabel: string }) {
  const point = active ? payload?.[0]?.payload : undefined;
  if (!point) return null;
  const sign = (value: number) => (value > 0 ? "+" : "");
  return (
    <div className="rounded-md border border-border bg-card px-2 py-1 text-xs shadow">
      <div className="text-[hsl(var(--card-muted-foreground))]">{new Date(point.t).toLocaleString("uk-UA", { timeZone: "Europe/Kyiv", dateStyle: "short", timeStyle: "short" })}</div>
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

/** FX-balance-style area chart with window presets over a cumulative series. Reused by the home and income pages. */
export function RangeAreaChart({
  data,
  currency = "USDT",
  hidden = false,
  totalLabel = "Всього",
  emptyLabel = "Немає даних за період",
  defaultPreset = "1m"
}: {
  data: RangePoint[];
  currency?: string;
  hidden?: boolean;
  totalLabel?: string;
  emptyLabel?: string;
  defaultPreset?: PresetKey;
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
  const color = points.length && points[points.length - 1].total < points[0].total ? LOSS_COLOR : PROFIT_COLOR;
  const low = values.length ? Math.min(...values) : 0;
  const high = values.length ? Math.max(...values) : 0;
  const pad = (high - low) * 0.1 || Math.max(1, Math.abs(high) * 0.02);

  return (
    <div className="flex min-h-52 flex-col rounded-lg bg-muted p-2">
      <div className="flex flex-wrap gap-0.5 sm:gap-1">
        {PRESETS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setPreset(item.key)}
            className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold leading-4 transition-colors ${preset === item.key ? "bg-foreground text-background" : "bg-background/70 text-[hsl(var(--card-muted-foreground))] hover:text-foreground"}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      {points.length < 2 ? (
        <div className="flex flex-1 items-center justify-center text-center text-sm text-[hsl(var(--card-muted-foreground))]">{emptyLabel}</div>
      ) : (
        <div className="relative mt-1 min-h-36 flex-1">
          <div className="absolute inset-0">
            <ResponsiveContainer>
              <AreaChart data={points} margin={{ left: 0, right: 0, top: 6, bottom: 0 }}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor={color} stopOpacity={0.3} />
                    <stop offset="1" stopColor={color} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <YAxis hide domain={[low - pad, high + pad]} />
                <Tooltip content={<Tip hidden={hidden} currency={currency} totalLabel={totalLabel} />} cursor={{ stroke: "hsl(var(--foreground) / 0.3)" }} />
                <Area type="monotone" dataKey="total" stroke={color} strokeWidth={2.5} fill={`url(#${gradientId})`} isAnimationActive={false} dot={false} activeDot={{ r: 4, fill: color, stroke: "hsl(var(--card))", strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
