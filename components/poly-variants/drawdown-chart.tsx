"use client";

import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { LOSS_COLOR } from "@/lib/chart-colors";
import { formatMoney } from "@/lib/money";

const AXIS_TICK = { fill: "hsl(var(--card-muted-foreground))", fontSize: 11 };

type Point = { t: number; drawdown: number; label: string };

/** How far below its own best the running result sat after each closed trade (0 = at a new high). */
export function DrawdownChart({ data, hidden }: { data: Point[]; hidden: boolean }) {
  if (!data.length) {
    return <div className="flex h-56 items-center justify-center rounded-lg border border-dashed border-border text-sm text-[hsl(var(--card-muted-foreground))]">Поки немає закритих угод</div>;
  }
  const points = data.map((point, index) => ({ ...point, n: index + 1 }));
  return (
    <div className="h-56">
      <ResponsiveContainer>
        <AreaChart data={points} margin={{ left: 0, right: 8, top: 6, bottom: 0 }}>
          <defs>
            <linearGradient id="poly-drawdown" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={LOSS_COLOR} stopOpacity={0.05} />
              <stop offset="100%" stopColor={LOSS_COLOR} stopOpacity={0.45} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="n" tick={AXIS_TICK} tickLine={false} axisLine={false} />
          <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={48} tickFormatter={(value: number) => (hidden ? "" : String(Math.round(value)))} />
          <ReferenceLine y={0} stroke="hsl(var(--border))" />
          <Tooltip
            content={({ active, payload }) => {
              const point = active ? (payload?.[0]?.payload as (Point & { n: number }) | undefined) : undefined;
              if (!point) return null;
              return (
                <div className="rounded-md border border-border bg-card px-2 py-1 text-xs shadow">
                  <div className="text-[hsl(var(--card-muted-foreground))]">
                    Угода № {point.n} · {new Date(point.t).toLocaleString("uk-UA", { timeZone: "Europe/Kyiv", dateStyle: "short", timeStyle: "short" })}
                  </div>
                  <div className="font-semibold tabular-nums">Нижче піку на {formatMoney(Math.abs(point.drawdown), "USDT", hidden)}</div>
                </div>
              );
            }}
          />
          <Area type="stepAfter" dataKey="drawdown" stroke={LOSS_COLOR} strokeWidth={2} fill="url(#poly-drawdown)" isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
