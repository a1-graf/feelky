"use client";

import { useId, useMemo, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import { formatMoney, formatSigned } from "@/lib/money";
import { LOSS_COLOR, PROFIT_COLOR } from "@/lib/chart-colors";

type Point = { t: number; balance: number; total: number; delta: number; kind: "trade" | "deposit" | "withdraw"; label: string };

const DAY = 86_400_000;
const PRESETS = [
  { key: "1d", label: "1D", span: DAY },
  { key: "1w", label: "1W", span: 7 * DAY },
  { key: "1m", label: "1M", span: 30 * DAY },
  { key: "3m", label: "3M", span: 90 * DAY },
  { key: "cd", label: "CD", span: 0 }
] as const;
type PresetKey = (typeof PRESETS)[number]["key"];

const dayStart = (value: string) => (value ? new Date(`${value}T00:00:00`).getTime() : NaN);
const dayEnd = (value: string) => (value ? new Date(`${value}T23:59:59.999`).getTime() : NaN);

function BalanceTooltip({ active, payload, hidden, currency, oneR }: { active?: boolean; payload?: Array<{ payload: Point }>; hidden: boolean; currency: string; oneR: number }) {
  const point = active ? payload?.[0]?.payload : undefined;
  if (!point) return null;
  return (
    <div className="rounded-md border border-border bg-card px-2 py-1 text-xs shadow">
      <div className="text-[hsl(var(--card-muted-foreground))]">{new Date(point.t).toLocaleString("uk-UA", { timeZone: "Europe/Kyiv", dateStyle: "short", timeStyle: "short" })}</div>
      <div className="font-semibold tabular-nums">{formatMoney(point.balance, currency, hidden)}</div>
      {point.label && (
        <div className="text-[hsl(var(--card-muted-foreground))]">
          {point.label}{" "}
          {point.delta !== 0 && <span className={point.delta > 0 ? "text-success" : "text-danger"}>{hidden ? "••••" : formatSigned(point.delta)}</span>}
        </div>
      )}
      <div className="text-[hsl(var(--card-muted-foreground))]">
        Total ${" "}
        <span className={point.total > 0 ? "text-success" : point.total < 0 ? "text-danger" : undefined}>{hidden ? "••••" : formatSigned(point.total)}</span>
      </div>
      {oneR > 0 && (
        <div className="text-[hsl(var(--card-muted-foreground))]">
          Total R{" "}
          <span className={point.total > 0 ? "text-success" : point.total < 0 ? "text-danger" : undefined}>{hidden ? "••••" : formatSigned(point.total / oneR)}</span>
        </div>
      )}
    </div>
  );
}

export function FxBalanceChart({ data, currency, oneR, hidden = false }: { data: Point[]; currency: string; oneR: number; hidden?: boolean }) {
  const gradientId = useId().replace(/:/g, "");
  const [preset, setPreset] = useState<PresetKey>("1m");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [now] = useState(() => Date.now());

  const points = useMemo<Point[]>(() => {
    if (!data.length) return [];
    let start: number;
    let end = now;
    if (preset === "cd") {
      start = Number.isNaN(dayStart(from)) ? data[0].t : dayStart(from);
      if (!Number.isNaN(dayEnd(to))) end = dayEnd(to);
    } else start = now - PRESETS.find((item) => item.key === preset)!.span;
    if (end <= start) end = start + DAY;

    const before = [...data].reverse().find((point) => point.t < start);
    const inside = data.filter((point) => point.t >= start && point.t <= end);
    if (!before && !inside.length) return [];
    // Before the first event the account did not exist yet, so the line starts at that event.
    const windowStart = before ? start : Math.max(start, inside[0].t);
    const startBalance = before ? before.balance : inside[0].balance;
    const startTotal = before ? before.total : inside[0].total;
    const last = inside[inside.length - 1]?.balance ?? startBalance;
    const lastTotal = inside[inside.length - 1]?.total ?? startTotal;
    return [
      { t: windowStart, balance: startBalance, total: startTotal, delta: 0, kind: "trade", label: "" },
      ...inside,
      { t: Math.min(end, Math.max(now, inside[inside.length - 1]?.t ?? windowStart)), balance: last, total: lastTotal, delta: 0, kind: "trade", label: "" }
    ];
  }, [data, preset, from, to, now]);

  const values = points.map((point) => point.balance);
  const color = points.length && points[points.length - 1].balance < points[0].balance ? LOSS_COLOR : PROFIT_COLOR;
  const low = values.length ? Math.min(...values) : 0;
  const high = values.length ? Math.max(...values) : 0;
  const pad = (high - low) * 0.1 || Math.max(1, Math.abs(high) * 0.02);

  return (
    <div className="flex min-h-44 flex-col rounded-lg bg-muted p-2">
      <div className="flex flex-wrap gap-0.5 sm:gap-1">
        {PRESETS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setPreset(item.key)}
            className={`rounded-md px-1 py-0.5 text-[11px] font-semibold leading-4 transition-colors sm:px-1.5 ${preset === item.key ? "bg-foreground text-background" : "bg-background/70 text-[hsl(var(--card-muted-foreground))] hover:text-foreground"}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      {preset === "cd" && (
        <div className="mt-1.5 grid grid-cols-1 gap-1 sm:grid-cols-2">
          <input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} aria-label="Від" className="min-w-0 rounded-md border border-border bg-background px-1 py-0.5 text-[11px] sm:px-1.5 sm:text-xs" />
          <input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} aria-label="До" className="min-w-0 rounded-md border border-border bg-background px-1 py-0.5 text-[11px] sm:px-1.5 sm:text-xs" />
        </div>
      )}
      {points.length < 2 ? (
        <div className="flex flex-1 items-center justify-center text-center text-sm text-[hsl(var(--card-muted-foreground))]">Немає угод за період</div>
      ) : (
        <div className="relative mt-1 min-h-28 flex-1">
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
                <Tooltip content={<BalanceTooltip hidden={hidden} currency={currency} oneR={oneR} />} cursor={{ stroke: "hsl(var(--foreground) / 0.3)" }} />
                <Area type="monotone" dataKey="balance" stroke={color} strokeWidth={2.5} fill={`url(#${gradientId})`} isAnimationActive={false} dot={false} activeDot={{ r: 4, fill: color, stroke: "hsl(var(--card))", strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
