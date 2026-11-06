"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { niceScale, shortAxisValue } from "@/lib/chart-scale";
import type { HomeFlow } from "@/lib/home-flow";
import { formatMoney } from "@/lib/money";

const INCOME = "hsl(var(--profit))";
const COSTS = "hsl(var(--loss))";
type Point = HomeFlow["series"][number];

function FlowTip({ active, payload, hidden }: { active?: boolean; payload?: readonly { payload?: Point }[]; hidden: boolean }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  const date = `${point.date.slice(8, 10)}.${point.date.slice(5, 7)}.${point.date.slice(0, 4)}`;
  return (
    <div className="gh-tip">
      <div className="gh-muted">{date}</div>
      <div><span className="gh-dot" style={{ background: INCOME }} />Дохід<b>{formatMoney(point.income, "USDT", hidden)}</b></div>
      <div><span className="gh-dot" style={{ background: COSTS }} />Витрати й мінуси<b>{formatMoney(point.costs, "USDT", hidden)}</b></div>
    </div>
  );
}

/** Two honest daily lines for the chosen period: straight segments between days, no smoothing. */
export function FlowChart({ series, hidden }: { series: Point[]; hidden: boolean }) {
  if (!series.length || series.every((point) => !point.income && !point.costs)) {
    return <div className="gh-empty">За цей період ще немає доходів і витрат</div>;
  }
  const scale = niceScale(series.flatMap((point) => [point.income, point.costs]), 4);
  const dots = series.length <= 45;
  return (
    <div className="gh-flow-chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--gh-border)" strokeDasharray="3 4" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={18} tick={{ fill: "var(--gh-muted)", fontSize: 11 }} />
          <YAxis domain={scale.domain} ticks={scale.ticks} width={58} tickLine={false} axisLine={false} tick={{ fill: "var(--gh-muted)", fontSize: 11 }} tickFormatter={(value: number) => (hidden ? "••" : shortAxisValue(value))} />
          <Tooltip content={(props) => <FlowTip active={props.active} payload={props.payload as readonly { payload?: Point }[]} hidden={hidden} />} cursor={{ stroke: "var(--gh-muted)", strokeDasharray: "3 3" }} />
          <Line type="linear" dataKey="income" name="Дохід" stroke={INCOME} strokeWidth={2.25} dot={dots ? { r: 2.5, fill: INCOME, strokeWidth: 0 } : false} activeDot={{ r: 4.5 }} isAnimationActive={false} />
          <Line type="linear" dataKey="costs" name="Витрати й мінуси" stroke={COSTS} strokeWidth={2.25} dot={dots ? { r: 2.5, fill: COSTS, strokeWidth: 0 } : false} activeDot={{ r: 4.5 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
