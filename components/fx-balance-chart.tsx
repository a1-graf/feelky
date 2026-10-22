"use client";

import { useId, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { shortAxisValue } from "@/lib/chart-scale";
import { formatMoney } from "@/lib/money";

type Point = { t: number; balance: number; delta: number; kind: "trade" | "deposit" | "withdraw"; label: string };

const PROFIT_COLOR = "#16a34a";
const LOSS_COLOR = "#e04d65";
const AXIS_TICK = { fill: "hsl(var(--card-muted-foreground))", fontSize: 12 };
const DAY = 86_400_000;
const PRESETS = [
  { key: "1d", label: "1 день", span: DAY },
  { key: "1w", label: "1 тиждень", span: 7 * DAY },
  { key: "1m", label: "1 міс", span: 30 * DAY },
  { key: "3m", label: "3 міс", span: 90 * DAY },
  { key: "all", label: "Все", span: 0 },
  { key: "custom", label: "Свої дати", span: 0 }
] as const;
type PresetKey = (typeof PRESETS)[number]["key"];

function niceTicks(low: number, high: number, count = 4) {
  const range = high - low || Math.max(1, Math.abs(high) * 0.02);
  const raw = range / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((candidate) => candidate >= raw) ?? raw);
  const first = Math.floor(low / step) * step;
  const last = Math.ceil(high / step) * step;
  const ticks: number[] = [];
  for (let value = first; value <= last + step / 2; value += step) ticks.push(Number(value.toFixed(8)));
  return ticks;
}

const dayStart = (value: string) => (value ? new Date(`${value}T00:00:00`).getTime() : NaN);
const dayEnd = (value: string) => (value ? new Date(`${value}T23:59:59.999`).getTime() : NaN);
const kyiv = { timeZone: "Europe/Kyiv" } as const;

function BalanceTooltip({ active, payload, hidden, currency }: { active?: boolean; payload?: Array<{ payload: Point }>; hidden: boolean; currency: string }) {
  const point = active ? payload?.[0]?.payload : undefined;
  if (!point) return null;
  return (
    <div className="rounded-md border border-border bg-card px-2.5 py-1.5 text-xs shadow">
      <div className="text-[hsl(var(--card-muted-foreground))]">{new Date(point.t).toLocaleString("uk-UA", { ...kyiv, dateStyle: "short", timeStyle: "short" })}</div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums">{formatMoney(point.balance.toFixed(2), currency, hidden)}</div>
      {point.label && (
        <div className="mt-0.5 text-[hsl(var(--card-muted-foreground))]">
          {point.label}{" "}
          {point.delta !== 0 && (
            <span className={point.delta > 0 ? "text-success" : "text-danger"}>{hidden ? "••••" : `${point.delta > 0 ? "+" : ""}${point.delta.toFixed(2)}`}</span>
          )}
        </div>
      )}
    </div>
  );
}

export function FxBalanceChart({ data, currency, hidden = false }: { data: Point[]; currency: string; hidden?: boolean }) {
  const gradientId = useId().replace(/:/g, "");
  const [preset, setPreset] = useState<PresetKey>("1m");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [now] = useState(() => Date.now());

  const view = useMemo(() => {
    if (!data.length) return null;
    let start: number;
    let end = now;
    if (preset === "all") start = data[0].t;
    else if (preset === "custom") {
      start = Number.isNaN(dayStart(from)) ? data[0].t : dayStart(from);
      if (!Number.isNaN(dayEnd(to))) end = dayEnd(to);
    } else start = now - PRESETS.find((p) => p.key === preset)!.span;
    if (end <= start) end = start + DAY;

    // The balance carried in from before the window, so the line starts at the left edge instead of mid-air.
    const before = [...data].reverse().find((point) => point.t < start);
    const inside = data.filter((point) => point.t >= start && point.t <= end);
    if (!before && !inside.length) return { start, end, points: [] as Point[] };
    // Before the very first event the account did not exist yet, so the window starts at that event.
    const windowStart = before ? start : Math.max(start, inside[0].t);
    const startBalance = before ? before.balance : inside[0].balance;
    const last = inside[inside.length - 1]?.balance ?? startBalance;
    const points: Point[] = [
      { t: windowStart, balance: startBalance, delta: 0, kind: "trade", label: "" },
      ...inside,
      { t: Math.min(end, Math.max(now, inside[inside.length - 1]?.t ?? windowStart)), balance: last, delta: 0, kind: "trade", label: "" }
    ];
    return { start: windowStart, end, points };
  }, [data, preset, from, to, now]);

  const points = view?.points ?? [];
  const values = points.map((point) => point.balance);
  const up = points.length ? points[points.length - 1].balance >= points[0].balance : true;
  const color = up ? PROFIT_COLOR : LOSS_COLOR;
  const low = values.length ? Math.min(...values) : 0;
  const high = values.length ? Math.max(...values) : 0;
  const yTicks = niceTicks(low, high);
  const xTicks = view ? Array.from({ length: 5 }, (_, index) => Math.round(view.start + ((view.end - view.start) * index) / 4)) : [];
  const spanMs = view ? view.end - view.start : DAY;
  const tickFormatter = (t: number) =>
    new Date(t).toLocaleString("uk-UA", spanMs <= 2 * DAY ? { ...kyiv, hour: "2-digit", minute: "2-digit" } : { ...kyiv, day: "2-digit", month: "2-digit" });
  const showDots = points.length <= 60;

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {PRESETS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setPreset(item.key)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${preset === item.key ? "bg-primary text-primary-foreground" : "bg-muted text-[hsl(var(--card-muted-foreground))] hover:text-foreground"}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      {preset === "custom" && (
        <div className="mb-3 grid max-w-md grid-cols-2 gap-2 text-sm">
          <input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} aria-label="Від" className="min-w-0 rounded-md border border-border bg-background px-2 py-1" />
          <input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} aria-label="До" className="min-w-0 rounded-md border border-border bg-background px-2 py-1" />
        </div>
      )}
      {points.length < 2 ? (
        <div className="flex h-56 items-center justify-center rounded-lg border border-dashed border-border text-sm text-[hsl(var(--card-muted-foreground))]">Немає угод за цей період</div>
      ) : (
        <div className="h-56 w-full sm:h-64">
          <ResponsiveContainer>
            <AreaChart data={points} margin={{ left: 0, right: 20, top: 8, bottom: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor={color} stopOpacity={0.28} />
                  <stop offset="1" stopColor={color} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="t" type="number" scale="time" domain={[view!.start, view!.end]} tickFormatter={tickFormatter} tickLine={false} axisLine={false} tick={AXIS_TICK} tickMargin={6} ticks={xTicks} interval={0} />
              <YAxis orientation="left" domain={[yTicks[0], yTicks[yTicks.length - 1]]} ticks={yTicks} interval={0} tickFormatter={(value: number) => (hidden ? "••" : shortAxisValue(Math.round(value)))} tickLine={false} axisLine={false} tick={AXIS_TICK} width={52} />
              <Tooltip content={<BalanceTooltip hidden={hidden} currency={currency} />} cursor={{ stroke: "hsl(var(--foreground) / 0.3)" }} />
              <Area
                type="stepAfter"
                dataKey="balance"
                stroke={color}
                strokeWidth={2.5}
                fill={`url(#${gradientId})`}
                isAnimationActive={false}
                baseValue="dataMin"
                dot={(props: { cx?: number; cy?: number; index?: number; payload?: Point }) =>
                  showDots && props.payload?.label && props.cx != null && props.cy != null ? (
                    <circle key={`dot-${props.index}`} cx={props.cx} cy={props.cy} r={3} fill={props.payload.kind === "trade" ? (props.payload.delta >= 0 ? PROFIT_COLOR : LOSS_COLOR) : "#3b82f6"} stroke="hsl(var(--card))" strokeWidth={1.5} />
                  ) : (
                    <g key={`dot-${props.index}`} />
                  )
                }
                activeDot={{ r: 5, fill: color, stroke: "hsl(var(--card))", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
