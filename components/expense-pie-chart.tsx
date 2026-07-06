"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatMoney } from "@/lib/money";

const COLORS = ["#e8795f", "#5d8aa8", "#d99b42", "#7e6aa8", "#4d9a78", "#c9566b", "#6d7f98", "#b7845b"];

type ExpensePoint = {
  name: string;
  value: string;
};

type ChartCurrency = "UAH" | "USDT" | "USD";

type ExpensePieChartProps = {
  data: ExpensePoint[];
  hidden?: boolean;
  emptyLabel?: string;
  currency?: ChartCurrency;
};

export function ExpensePieChart({
  data,
  hidden = false,
  emptyLabel = "\u041f\u043e\u043a\u0438 \u043d\u0435\u043c\u0430\u0454 \u0432\u0438\u0442\u0440\u0430\u0442",
  currency = "UAH"
}: ExpensePieChartProps) {
  const chartData = data.map((item, index) => ({
    ...item,
    amount: Number(item.value),
    color: COLORS[index % COLORS.length]
  }));
  const total = chartData.reduce((sum, item) => sum + item.amount, 0);

  if (!chartData.length || total <= 0) {
    return <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border text-sm text-[hsl(var(--card-muted-foreground))]">{emptyLabel}</div>;
  }

  return (
    <div>
      <div className="mb-2 text-sm text-[hsl(var(--card-muted-foreground))]">
        Загалом: <span className="font-semibold text-[hsl(var(--card-foreground))]">{formatMoney(total, currency, hidden)}</span>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px] lg:items-center">
        <div className="h-64 min-w-0">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={chartData} dataKey="amount" nameKey="name" innerRadius="54%" outerRadius="82%" paddingAngle={3} stroke="hsl(var(--card))" strokeWidth={4}>
                {chartData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value, name) => [formatMoney(Number(value), currency, hidden), name]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="grid gap-2">
          {chartData.slice(0, 6).map((item) => (
            <div key={item.name} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="truncate">{item.name}</span>
              </span>
              <span className="shrink-0 font-semibold">{hidden ? "****" : Math.round((item.amount / total) * 100) + "%"}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
