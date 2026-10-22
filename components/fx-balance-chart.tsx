"use client";

import { useId } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import { formatMoney } from "@/lib/money";

type Point = { date: string; label: string; balance: number };

const PROFIT_COLOR = "#16a34a";
const LOSS_COLOR = "#e04d65";

function BalanceTooltip({ active, payload, hidden, currency }: { active?: boolean; payload?: Array<{ payload: Point }>; hidden: boolean; currency: string }) {
  const point = active ? payload?.[0]?.payload : undefined;
  if (!point) return null;
  return (
    <div className="rounded-md border border-border bg-card px-2 py-1 text-xs shadow">
      <div className="text-[hsl(var(--card-muted-foreground))]">{point.label}</div>
      <div className="font-semibold tabular-nums">{formatMoney(point.balance.toFixed(2), currency, hidden)}</div>
    </div>
  );
}

export function FxBalanceChart({ data, currency, hidden = false }: { data: Point[]; currency: string; hidden?: boolean }) {
  const gradientId = useId().replace(/:/g, "");
  if (data.length < 2) {
    return <div className="flex h-full min-h-28 items-center justify-center rounded-lg bg-muted text-sm text-[hsl(var(--card-muted-foreground))]">Поки немає даних</div>;
  }
  const up = data[data.length - 1].balance >= data[0].balance;
  const color = up ? PROFIT_COLOR : LOSS_COLOR;
  const values = data.map((point) => point.balance);
  const pad = (Math.max(...values) - Math.min(...values)) * 0.1 || 1;

  return (
    <div className="relative h-full min-h-28 overflow-hidden rounded-lg bg-muted">
      <div className="absolute inset-0">
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={color} stopOpacity={0.3} />
                <stop offset="1" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <YAxis hide domain={[Math.min(...values) - pad, Math.max(...values) + pad]} />
            <Tooltip content={<BalanceTooltip hidden={hidden} currency={currency} />} cursor={{ stroke: "hsl(var(--foreground) / 0.3)" }} />
            <Area type="monotone" dataKey="balance" stroke={color} strokeWidth={2.5} fill={`url(#${gradientId})`} isAnimationActive={false} dot={false} activeDot={{ r: 4, fill: color, stroke: "hsl(var(--card))", strokeWidth: 2 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
