import Decimal from "decimal.js";
import { calendarDays, dayLabel } from "@/lib/chart-scale";
import { D } from "@/lib/money";

/** Pure home-page money flow: per-day income vs. costs and the two donuts under the chart. No database, unit-testable. */

export type FlowEvent = {
  date: Date;
  net: Decimal.Value;
  kind: "income" | "expense" | "flip" | "fx" | "poly" | "fork";
  source: string;
  /** Expense category name; only for kind "expense". */
  category?: string;
};

export const LOSS_LABEL = "Мінуси";
export const INCOME_ORDER = ["Фліпи", "Вилки", "Steam", "Форекс", "Polymarket", "Ручні доходи"];

/** Which donut slice a non-expense result belongs to. */
export function incomeGroup(event: Pick<FlowEvent, "kind" | "source">) {
  if (event.kind === "flip" || event.source === "Фліпи") return "Фліпи";
  if (event.kind === "fork" || event.source === "Вилки") return "Вилки";
  if (/^steam/i.test(event.source)) return "Steam";
  if (event.kind === "fx" || /aurum|forex|форекс/i.test(event.source)) return "Форекс";
  if (event.kind === "poly" || /polymarket/i.test(event.source)) return "Polymarket";
  return "Ручні доходи";
}

const dayKey = (date: Date) => date.toISOString().slice(0, 10);

/**
 * Each day every direction is netted on its own: a direction that closed the day in plus adds to "Дохід",
 * one that closed it in minus adds to "Мінуси" (red line). Every expense adds to the red line by its category.
 * So the green line sums to the income donut and the red line to the costs donut, day by day.
 */
export function buildHomeFlow(events: FlowEvent[], range: { from?: string; to?: string } = {}) {
  const perDay = new Map<string, Map<string, Decimal>>();
  const spendPerDay = new Map<string, Decimal>();
  const byCategory = new Map<string, Decimal>();
  for (const event of events) {
    const key = dayKey(event.date);
    if (event.kind === "expense") {
      const value = D(event.net).abs();
      spendPerDay.set(key, D(spendPerDay.get(key) || 0).plus(value));
      const category = event.category || "Без категорії";
      byCategory.set(category, D(byCategory.get(category) || 0).plus(value));
      continue;
    }
    const day = perDay.get(key) || new Map<string, Decimal>();
    const group = incomeGroup(event);
    day.set(group, D(day.get(group) || 0).plus(event.net));
    perDay.set(key, day);
  }

  const incomeBySource = new Map<string, Decimal>();
  const incomeDay = new Map<string, Decimal>();
  const lossDay = new Map<string, Decimal>();
  let losses = new Decimal(0);
  for (const [key, groups] of perDay) {
    for (const [group, net] of groups) {
      if (net.gt(0)) {
        incomeBySource.set(group, D(incomeBySource.get(group) || 0).plus(net));
        incomeDay.set(key, D(incomeDay.get(key) || 0).plus(net));
      } else if (net.lt(0)) {
        losses = losses.plus(net.abs());
        lossDay.set(key, D(lossDay.get(key) || 0).plus(net.abs()));
      }
    }
  }

  const keys = Array.from(new Set([...perDay.keys(), ...spendPerDay.keys()]));
  const days = keys.length || (range.from && range.to) ? calendarDays(keys, range.from, range.to, 400) : [];
  const round = (value: Decimal | undefined) => (value || new Decimal(0)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
  const series = days.map((date) => ({
    date,
    label: dayLabel(date),
    income: round(incomeDay.get(date)),
    costs: round(D(spendPerDay.get(date) || 0).plus(lossDay.get(date) || 0))
  }));

  const income = INCOME_ORDER.map((name) => ({ name, value: round(incomeBySource.get(name)) })).filter((item) => item.value > 0);
  const costs = Array.from(byCategory, ([name, value]) => ({ name, value: round(value) }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);
  if (round(losses) > 0) costs.push({ name: LOSS_LABEL, value: round(losses) });

  const sum = (items: { value: number }[]) => round(items.reduce((total, item) => total.plus(item.value), new Decimal(0)));
  return { series, income, costs, incomeTotal: sum(income), costsTotal: sum(costs) };
}

export type HomeFlow = ReturnType<typeof buildHomeFlow>;
