export const PERIOD_PRESETS = [
  { key: "week", label: "Тиждень", days: 7 },
  { key: "month", label: "Місяць", days: 0 },
  { key: "3m", label: "3 міс", days: 90 },
  { key: "6m", label: "6 міс", days: 180 },
  { key: "12m", label: "12 міс", days: 365 },
  { key: "all", label: "Весь час", days: 0 }
] as const;

export type PeriodKey = (typeof PERIOD_PRESETS)[number]["key"];
export type PeriodInput = { period?: string; month?: string };

export const MONTH_SHORT = ["Січ", "Лют", "Бер", "Кві", "Тра", "Чер", "Лип", "Сер", "Вер", "Жов", "Лис", "Гру"];

const dayFormatter = new Intl.DateTimeFormat("uk-UA", { day: "2-digit", month: "2-digit", year: "numeric" });

function localDate(year: number, monthIndex: number, day: number, endOfDay = false) {
  const date = new Date(year, monthIndex, day);
  if (endOfDay) date.setHours(23, 59, 59, 999);
  else date.setHours(0, 0, 0, 0);
  return date;
}

/** One period model for every page: a preset (week/month/3m/6m/12m/all) or one specific calendar month (?month=YYYY-MM). */
export function resolvePeriod(input: PeriodInput = {}, now = new Date()) {
  const match = /^(\d{4})-(\d{2})$/.exec(input.month || "");
  const monthNumber = match ? Number(match[2]) : 0;
  const customMonth = Boolean(match && monthNumber >= 1 && monthNumber <= 12);
  const preset = PERIOD_PRESETS.find((item) => item.key === input.period)?.key ?? "month";

  let key: PeriodKey | "custom" = customMonth ? "custom" : preset;
  let from: Date;
  let to = now;
  let label: string;
  let month: string | null = null;
  const currentMonthStart = localDate(now.getFullYear(), now.getMonth(), 1);

  if (key === "custom") {
    const year = Number(match![1]);
    const monthIndex = monthNumber - 1;
    from = localDate(year, monthIndex, 1);
    const nextMonthStart = localDate(year, monthIndex + 1, 1);
    if (from.getTime() > now.getTime()) key = "month";
    else if (nextMonthStart.getTime() <= now.getTime()) to = new Date(nextMonthStart.getTime() - 1);
    month = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
    label = new Intl.DateTimeFormat("uk-UA", { month: "long", year: "numeric" }).format(from);
  } else if (key === "all") {
    from = new Date(2000, 0, 1);
    label = "весь час";
  } else if (key === "month") {
    from = currentMonthStart;
    label = new Intl.DateTimeFormat("uk-UA", { month: "long", year: "numeric" }).format(from);
  } else {
    const item = PERIOD_PRESETS.find((entry) => entry.key === key)!;
    from = localDate(now.getFullYear(), now.getMonth(), now.getDate() - item.days + 1);
    label = item.label.toLowerCase();
  }
  if (key === "month") {
    from = currentMonthStart;
    to = now;
    month = null;
    label = new Intl.DateTimeFormat("uk-UA", { month: "long", year: "numeric" }).format(from);
  }

  const phrase = key === "all" ? "за весь час" : key === "month" || key === "custom" ? `за ${label}` : `за останні ${PERIOD_PRESETS.find((entry) => entry.key === key)!.days} дн.`;

  return {
    key,
    month,
    from,
    to,
    label,
    phrase,
    rangeLabel: key === "all" ? "весь час" : `${dayFormatter.format(from)} - ${dayFormatter.format(to)}`,
    range: { gte: from, lte: to }
  };
}

export type ResolvedPeriod = ReturnType<typeof resolvePeriod>;

/** Window preset of RangeAreaChart that matches the page period (a single month falls back to all time). */
export function chartPresetFor(key: string): "1w" | "1m" | "3m" | "6m" | "1y" | "all" {
  return ({ week: "1w", month: "1m", "3m": "3m", "6m": "6m", "12m": "1y" } as const)[key as "week"] ?? "all";
}
