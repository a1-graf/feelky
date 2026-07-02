"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney } from "@/lib/money";

type IncomeTimelinePoint = {
  date: string;
  label: string;
  usdt: number;
  uah: number;
};

type IncomeLineChartProps = {
  data: IncomeTimelinePoint[];
  hidden?: boolean;
};

const tooltipFormatter = (hidden: boolean) => (value: number, name: string) => {
  const currency = name === "USDT" ? "USDT" : "UAH";
  return [formatMoney(value, currency, hidden), name];
};

export function IncomeLineChart({ data, hidden = false }: IncomeLineChartProps) {
  const hasIncome = data.some((item) => item.usdt > 0 || item.uah > 0);

  if (!data.length || !hasIncome) {
    return <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border text-sm text-[hsl(var(--card-muted-foreground))]">Поки немає доходів</div>;
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[hsl(var(--card-muted-foreground))]">
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-8 rounded-full bg-[#2563eb]" />
          USDT
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-0 w-8 border-t-2 border-dashed border-[#e8795f]" />
          UAH
        </span>
      </div>
      <div className="h-72 w-full">
        <ResponsiveContainer>
          <LineChart data={data} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--card-muted-foreground))", fontSize: 12 }} />
            <YAxis
              yAxisId="usdt"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "hsl(var(--card-muted-foreground))", fontSize: 12 }}
              tickFormatter={(value) => (hidden ? "****" : `${value}`)}
              width={44}
            />
            <YAxis
              yAxisId="uah"
              orientation="right"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "hsl(var(--card-muted-foreground))", fontSize: 12 }}
              tickFormatter={(value) => (hidden ? "****" : `${value}`)}
              width={44}
            />
            <Tooltip formatter={tooltipFormatter(hidden)} labelFormatter={(label) => `Дата: ${label}`} />
            <Line yAxisId="usdt" type="monotone" dataKey="usdt" name="USDT" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            <Line yAxisId="uah" type="monotone" dataKey="uah" name="UAH" stroke="#e8795f" strokeWidth={2.5} strokeDasharray="7 5" dot={{ r: 3 }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
