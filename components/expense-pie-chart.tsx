"use client";

import { useMemo } from "react";
import { DonutBreakdown } from "@/components/donut-breakdown";

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

export function ExpensePieChart({ data, hidden = false, emptyLabel = "Поки немає витрат", currency = "UAH" }: ExpensePieChartProps) {
  const items = useMemo(() => data.map((item) => ({ name: item.name, value: Number(item.value) })), [data]);
  return <DonutBreakdown items={items} colors={COLORS} currency={currency} hidden={hidden} emptyLabel={emptyLabel} />;
}
