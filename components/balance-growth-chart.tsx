"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney } from "@/lib/money";

type BalancePoint = {
  date: string;
  label: string;
  full: number;
  available: number;
};

export function BalanceGrowthChart({ data, hidden = false }: { data: BalancePoint[]; hidden?: boolean }) {
  if (!data.length) {
    return <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border text-sm text-[hsl(var(--card-muted-foreground))]">Поки немає даних</div>;
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[hsl(var(--card-muted-foreground))]">
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-8 rounded-full bg-[#2563eb]" />
          Повний
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-8 rounded-full bg-[#16a34a]" />
          Доступний + в обороті
        </span>
      </div>
      <div className="h-72 w-full">
        <ResponsiveContainer>
          <LineChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--card-muted-foreground))", fontSize: 12 }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--card-muted-foreground))", fontSize: 12 }} tickFormatter={(value) => (hidden ? "****" : `${value}`)} width={48} />
            <Tooltip
              formatter={(value, name) => [formatMoney(Number(value), "USDT", hidden), name === "full" ? "Повний" : "Доступний + в обороті"]}
              labelFormatter={(label) => `Дата: ${label}`}
            />
            <Line type="monotone" dataKey="full" name="full" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            <Line type="monotone" dataKey="available" name="available" stroke="#16a34a" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
