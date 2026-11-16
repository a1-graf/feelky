"use client";

import { useMemo, useState } from "react";
import type { PolyDay } from "@/lib/poly-calendar";
import {
  SHADE_CAP,
  SHADE_STEPS,
  shadeColor,
  shadeStep,
  shadeTextDark,
} from "@/lib/poly-shade";
import { D, formatPlain, formatSigned } from "@/lib/money";
import { cn } from "@/lib/ui";

const muted = "text-[hsl(var(--card-muted-foreground))]";
const tone = (value: number) =>
  value > 0.004 ? "text-success" : value < -0.004 ? "text-danger" : muted;
const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];
const MONTHS = [
  "Січень",
  "Лютий",
  "Березень",
  "Квітень",
  "Травень",
  "Червень",
  "Липень",
  "Серпень",
  "Вересень",
  "Жовтень",
  "Листопад",
  "Грудень",
];
const LEGEND_STEPS = Array.from(
  { length: SHADE_STEPS },
  (_, index) => index + 1,
);

const pad = (value: number) => String(value).padStart(2, "0");
const dm = (date: string) => `${date.slice(8, 10)}.${date.slice(5, 7)}`;
function plural(count: number, one: string, few: string, many: string) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  return mod10 === 1 && mod100 !== 11
    ? one
    : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
      ? few
      : many;
}

/** Month grid of daily results: ten shades of green and red (every 50 USD one step, up to 500), a weekly total on the right. */
export function PolyDayCalendar({
  days,
  today,
  currency,
  hidden,
}: {
  days: PolyDay[];
  today: string;
  currency: string;
  hidden: boolean;
}) {
  const byDay = useMemo(
    () => new Map(days.map((day) => [day.date, day])),
    [days],
  );
  const months = useMemo(() => {
    const first = (days[0]?.date ?? today).slice(0, 7);
    const last = [days.at(-1)?.date ?? today, today].sort().at(-1)!.slice(0, 7);
    const list: string[] = [];
    let [year, month] = first.split("-").map(Number);
    const [lastYear, lastMonth] = last.split("-").map(Number);
    while (year < lastYear || (year === lastYear && month <= lastMonth)) {
      list.push(`${year}-${pad(month)}`);
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }
    return list;
  }, [days, today]);
  const [index, setIndex] = useState(() => {
    const latest = (days.at(-1)?.date ?? today).slice(0, 7);
    return Math.max(0, months.indexOf(latest));
  });
  const [selected, setSelected] = useState<string | null>(null);
  const monthKey = months[index];
  const [year, month] = monthKey.split("-").map(Number);
  const length = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const lead = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const cells: Array<string | null> = [
    ...Array<null>(lead).fill(null),
    ...Array.from({ length }, (_, i) => `${monthKey}-${pad(i + 1)}`),
  ];
  while (cells.length % 7) cells.push(null);

  const selectedDay = selected ? byDay.get(selected) : undefined;
  const monthDays = days.filter((day) => day.date.startsWith(monthKey));
  const monthSum = monthDays.reduce((sum, day) => sum.plus(day.pnl), D(0));
  const money = (value: Parameters<typeof formatSigned>[0]) =>
    hidden ? "••••" : `${formatSigned(value)} ${currency}`;
  const arrow =
    "flex size-7 items-center sm:size-8 justify-center rounded-md bg-muted text-base disabled:opacity-30";
  const weeks = Array.from({ length: cells.length / 7 }, (_, week) =>
    cells.slice(week * 7, week * 7 + 7),
  );

  return (
    <section
      aria-label="PnL по днях"
      className="mt-4 rounded-2xl border border-border/60 bg-card/80 p-4 text-[hsl(var(--card-foreground))] shadow-card sm:p-6"
    >
      <div className="mb-3 flex items-center justify-between gap-2 sm:mb-4">
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          <button
            type="button"
            aria-label="Попередній місяць"
            disabled={index === 0}
            onClick={() => {
              setIndex(index - 1);
              setSelected(null);
            }}
            className={`${arrow} ${muted}`}
          >
            ‹
          </button>
          <h2 className="whitespace-nowrap text-[15px] font-bold sm:text-xl">
            {MONTHS[month - 1]} {year}
          </h2>
          <button
            type="button"
            aria-label="Наступний місяць"
            disabled={index === months.length - 1}
            onClick={() => {
              setIndex(index + 1);
              setSelected(null);
            }}
            className={`${arrow} ${muted}`}
          >
            ›
          </button>
        </div>
        <div
          className={cn(
            "whitespace-nowrap text-sm font-bold tabular-nums sm:text-xl",
            hidden ? "" : tone(monthSum.toNumber()),
          )}
        >
          {money(monthSum)}
        </div>
      </div>

      <div className="rounded-lg bg-muted p-2.5 sm:p-4">
        <div className="grid grid-cols-[repeat(7,minmax(0,1fr))_4.25rem] gap-1 sm:grid-cols-[repeat(7,minmax(0,1fr))_6.5rem] sm:gap-1.5">
          {WEEKDAYS.map((name) => (
            <div
              key={name}
              className={`pb-1 text-center text-[10px] sm:text-xs ${muted}`}
            >
              {name}
            </div>
          ))}
          <div className={`pb-1 text-right text-[10px] sm:text-xs ${muted}`}>
            Тиждень
          </div>
          {weeks.map((week, weekIndex) => {
            const results = week.map((key) =>
              key ? byDay.get(key) : undefined,
            );
            const weekSum = results.reduce(
              (sum, day) => sum.plus(day?.pnl ?? 0),
              D(0),
            );
            return [
              ...week.map((key, dayIndex) => {
                if (!key) return <div key={`${weekIndex}-${dayIndex}`} />;
                const day = results[dayIndex];
                const value = day ? Number(day.pnl) : 0;
                const step = day ? shadeStep(value) : 0;
                const label = day
                  ? `${dm(key)}: ${money(day.pnl)} · ${day.count} ${plural(day.count, "угода", "угоди", "угод")}`
                  : dm(key);
                const Cell = day ? "button" : "div";
                return (
                  <Cell
                    key={key}
                    {...(day
                      ? {
                          type: "button" as const,
                          onClick: () =>
                            setSelected(selected === key ? null : key),
                          "aria-pressed": selected === key,
                        }
                      : {})}
                    title={label}
                    aria-label={label}
                    className={cn(
                      "relative flex h-10 flex-col rounded-md px-1 py-0.5 text-left text-[10px] tabular-nums sm:h-16 sm:px-2 sm:py-1.5 sm:text-xs",
                      day &&
                        "cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground/60",
                      selected === key && "ring-2 ring-foreground/70",
                      step === 0
                        ? key > today
                          ? "bg-foreground/[0.04] text-foreground/25"
                          : "bg-foreground/10 text-foreground/55"
                        : shadeTextDark(step, value > 0)
                          ? "font-bold text-black"
                          : "font-bold text-white",
                    )}
                    style={
                      step > 0
                        ? { backgroundColor: shadeColor(step, value > 0) }
                        : undefined
                    }
                  >
                    <span>{Number(key.slice(8))}</span>
                    {day && (
                      <span className="mt-auto hidden truncate text-center text-[11px] font-semibold sm:block">
                        {hidden ? "••••" : formatSigned(day.pnl)}
                      </span>
                    )}
                  </Cell>
                );
              }),
              <div
                key={`w${weekIndex}`}
                className={cn(
                  "self-center text-right text-xs font-bold tabular-nums sm:text-sm",
                  hidden
                    ? ""
                    : weekSum.isZero()
                      ? muted
                      : tone(weekSum.toNumber()),
                )}
              >
                {hidden
                  ? "••••"
                  : weekSum.isZero()
                    ? formatPlain(0)
                    : formatSigned(weekSum)}
              </div>,
            ];
          })}
        </div>

        <div
          aria-live="polite"
          className={cn(
            "mt-3 min-h-5 text-center text-sm font-semibold tabular-nums",
            selectedDay && !hidden ? tone(Number(selectedDay.pnl)) : muted,
          )}
        >
          {selectedDay
            ? `${dm(selectedDay.date)}: ${money(selectedDay.pnl)} · ${selectedDay.count} ${plural(selectedDay.count, "угода", "угоди", "угод")}`
            : "Торкнись дня, щоб побачити результат"}
        </div>

        <div
          className={`mt-2 flex items-center justify-end gap-1.5 whitespace-nowrap text-[10px] sm:text-xs ${muted}`}
        >
          <span>−{SHADE_CAP}</span>
          <div className="flex gap-0.5">
            {[...LEGEND_STEPS].reverse().map((step) => (
              <i
                key={`r${step}`}
                title={`до −${step * (SHADE_CAP / SHADE_STEPS)}`}
                className="size-2.5 rounded-[3px] sm:size-3.5"
                style={{ backgroundColor: shadeColor(step, false) }}
              />
            ))}
            <i
              className="mx-0.5 size-2.5 rounded-[3px] bg-foreground/10 sm:size-3.5"
              title="0"
            />
            {LEGEND_STEPS.map((step) => (
              <i
                key={`g${step}`}
                title={`до +${step * (SHADE_CAP / SHADE_STEPS)}`}
                className="size-2.5 rounded-[3px] sm:size-3.5"
                style={{ backgroundColor: shadeColor(step, true) }}
              />
            ))}
          </div>
          <span>+{SHADE_CAP}</span>
        </div>
      </div>

    </section>
  );
}
