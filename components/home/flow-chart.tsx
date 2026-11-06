"use client";

import { useId } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { LOSS_COLOR, PROFIT_COLOR } from "@/lib/chart-colors";
import { niceScale, shortAxisValue } from "@/lib/chart-scale";
import type { HomeFlow } from "@/lib/home-flow";
import { formatMoney } from "@/lib/money";

type Point = HomeFlow["series"][number];

// Same axes, grid and tooltip as the Polymarket and Forex charts.
const AXIS_TICK = { fill: "hsl(var(--card-muted-foreground))", fontSize: 11 };

function FlowTip({ active, payload, hidden }: { active?: boolean; payload?: readonly { payload?: Point }[]; hidden: boolean }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  const date = `${point.date.slice(8, 10)}.${point.date.slice(5, 7)}.${point.date.slice(0, 4)}`;
  return (
    <div className="rounded-md border border-border bg-card px-2 py-1 text-xs shadow">
      <div className="text-[hsl(var(--card-muted-foreground))]">{date}</div>
      <div className="flex items-center gap-1.5"><span className="gh-dot" style={{ background: PROFIT_COLOR }} />Дохід<b className="ml-auto pl-3 font-semibold tabular-nums text-success">{formatMoney(point.income, "USDT", hidden)}</b></div>
      <div className="flex items-center gap-1.5"><span className="gh-dot" style={{ background: LOSS_COLOR }} />Витрати й мінуси<b className="ml-auto pl-3 font-semibold tabular-nums text-danger">{formatMoney(point.costs, "USDT", hidden)}</b></div>
    </div>
  );
}

/** Daily income and costs as two smooth Polymarket-style lines with a soft gradient under each. */
export function FlowChart({ series, hidden }: { series: Point[]; hidden: boolean }) {
  const gradientId = useId().replace(/:/g, "");
  if (!series.length || series.every((point) => !point.income && !point.costs)) {
    return <div className="gh-empty">За цей період ще немає доходів і витрат</div>;
  }
  const scale = niceScale(series.flatMap((point) => [point.income, point.costs]), 4);
  // Label every n-th day so the dates are spread evenly and never collide on a phone.
  const labelInterval = Math.max(0, Math.ceil(series.length / 7) - 1);
  return (
    <div className="gh-flow-chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ left: 0, right: 8, top: 6, bottom: 0 }}>
          <defs>
            <linearGradient id={`${gradientId}-income`} x1="0" y1="0" x2="0" y2="1">
              <stop offset={0} stopColor={PROFIT_COLOR} stopOpacity={0.28} />
              <stop offset={1} stopColor={PROFIT_COLOR} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id={`${gradientId}-costs`} x1="0" y1="0" x2="0" y2="1">
              <stop offset={0} stopColor={LOSS_COLOR} stopOpacity={0.22} />
              <stop offset={1} stopColor={LOSS_COLOR} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS_TICK} tickMargin={6} interval={labelInterval} padding={{ left: 8, right: 8 }} />
          <YAxis domain={scale.domain} ticks={scale.ticks} interval={0} width={56} tickLine={false} axisLine={false} tick={AXIS_TICK} tickFormatter={(value: number) => (hidden ? "••" : shortAxisValue(value))} />
          <Tooltip content={(props) => <FlowTip active={props.active} payload={props.payload as readonly { payload?: Point }[]} hidden={hidden} />} cursor={{ stroke: "hsl(var(--foreground) / 0.3)" }} />
          <Area type="monotone" dataKey="income" name="Дохід" baseValue={scale.domain[0]} stroke={PROFIT_COLOR} strokeWidth={2.5} fill={`url(#${gradientId}-income)`} dot={false} activeDot={{ r: 4, fill: PROFIT_COLOR, stroke: "hsl(var(--card))", strokeWidth: 2 }} isAnimationActive={false} />
          <Area type="monotone" dataKey="costs" name="Витрати й мінуси" baseValue={scale.domain[0]} stroke={LOSS_COLOR} strokeWidth={2.5} fill={`url(#${gradientId}-costs)`} dot={false} activeDot={{ r: 4, fill: LOSS_COLOR, stroke: "hsl(var(--card))", strokeWidth: 2 }} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
