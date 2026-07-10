"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatMoney } from "@/lib/money";

const COLORS = ["#e8795f", "#5d8aa8", "#d99b42", "#7e6aa8", "#4d9a78", "#c9566b", "#6d7f98", "#b7845b"];

type IncomePoint = {
  name: string;
  value: string;
};

type ChartPoint = IncomePoint & {
  amount: number;
  color: string;
  currency: "UAH" | "USDT";
  label: string;
};

type IncomeDonutChartProps = {
  usdtData: IncomePoint[];
  uahData: IncomePoint[];
  hidden?: boolean;
};

export function IncomeDonutChart({ usdtData, uahData, hidden = false }: IncomeDonutChartProps) {
  const sourceNames = Array.from(new Set([...usdtData, ...uahData].map((item) => item.name)));
  const colorBySource = new Map(sourceNames.map((name, index) => [name, COLORS[index % COLORS.length]]));
  const toChartData = (data: IncomePoint[], currency: "UAH" | "USDT"): ChartPoint[] => data
    .map((item) => ({
      ...item,
      amount: Number(item.value),
      color: colorBySource.get(item.name) || COLORS[0],
      currency,
      label: `${item.name} · ${currency}`
    }))
    .filter((item) => Number.isFinite(item.amount) && item.amount > 0);

  const usdt = toChartData(usdtData, "USDT");
  const uah = toChartData(uahData, "UAH");
  const usdtTotal = usdt.reduce((sum, item) => sum + item.amount, 0);
  const uahTotal = uah.reduce((sum, item) => sum + item.amount, 0);

  if (!usdt.length && !uah.length) {
    return <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border text-sm text-[hsl(var(--card-muted-foreground))]">Поки немає доходів</div>;
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[hsl(var(--card-muted-foreground))]">
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-8 bg-[#5d8aa8]" />
          USDT: <b className="text-[hsl(var(--card-foreground))]">{formatMoney(usdtTotal, "USDT", hidden)}</b>
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-0 w-8 border-t-2 border-dashed border-[#e8795f]" />
          UAH: <b className="text-[hsl(var(--card-foreground))]">{formatMoney(uahTotal, "UAH", hidden)}</b>
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center">
        <div className="h-72 min-w-0">
          <ResponsiveContainer>
            <PieChart>
              {usdt.length > 0 && (
                <Pie
                  data={usdt}
                  dataKey="amount"
                  nameKey="label"
                  innerRadius="66%"
                  outerRadius="88%"
                  paddingAngle={3}
                  cornerRadius={3}
                  stroke="hsl(var(--card))"
                  strokeWidth={4}
                >
                  {usdt.map((entry) => <Cell key={entry.label} fill={entry.color} />)}
                </Pie>
              )}
              {uah.length > 0 && (
                <Pie
                  data={uah}
                  dataKey="amount"
                  nameKey="label"
                  innerRadius="40%"
                  outerRadius="59%"
                  paddingAngle={4}
                  cornerRadius={2}
                  stroke="hsl(var(--card-foreground))"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                >
                  {uah.map((entry) => <Cell key={entry.label} fill={entry.color} fillOpacity={0.72} />)}
                </Pie>
              )}
              <Tooltip
                formatter={(value, name) => {
                  const label = String(name);
                  const currency = label.endsWith("UAH") ? "UAH" : "USDT";
                  return [formatMoney(Number(value), currency, hidden), label.replace(` · ${currency}`, "")];
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="grid gap-4">
          <IncomeLegend title="USDT · зовнішнє" data={usdt} total={usdtTotal} hidden={hidden} dashed={false} />
          <IncomeLegend title="UAH · внутрішнє" data={uah} total={uahTotal} hidden={hidden} dashed />
        </div>
      </div>
    </div>
  );
}

function IncomeLegend({ title, data, total, hidden, dashed }: {
  title: string;
  data: ChartPoint[];
  total: number;
  hidden: boolean;
  dashed: boolean;
}) {
  if (!data.length) return null;
  return (
    <div>
      <div className="mb-2 text-xs font-semibold text-[hsl(var(--card-muted-foreground))]">{title}</div>
      <div className="grid gap-2">
        {data.slice(0, 6).map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className={`h-3 w-3 shrink-0 rounded-full ${dashed ? "border-2 border-dashed bg-transparent" : ""}`}
                style={dashed ? { borderColor: item.color } : { backgroundColor: item.color }}
              />
              <span className="truncate">{item.name}</span>
            </span>
            <span className="shrink-0 font-semibold">{hidden ? "****" : `${Math.round((item.amount / total) * 100)}%`}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
