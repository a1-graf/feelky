"use client";

import { useState } from "react";

const MONTHS = ["січень", "лютий", "березень", "квітень", "травень", "червень", "липень", "серпень", "вересень", "жовтень", "листопад", "грудень"];
const WEEKDAYS = ["пн", "вт", "ср", "чт", "пт", "сб", "нд"];
const muted = "text-[hsl(var(--card-muted-foreground))]";
const chip = `h-8 whitespace-nowrap rounded-md bg-muted px-2 text-[11px] font-semibold ${muted} transition-colors hover:text-foreground`;

/** Local calendar day as `YYYY-MM-DD`; string order is date order. */
export const isoDay = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const parse = (value: string) => new Date(`${value}T00:00:00`);
const label = (value: string) => (value ? value.split("-").reverse().join(".") : "—");

export type DayRange = { from: string; to: string };

/**
 * Month grid range picker: the first tap sets the start, the second the end (order fixed automatically, the same day twice is a one-day range).
 * Future days are disabled; presets fill a whole month or year at once.
 */
export function RangeCalendar({ initial, onApply, onClose }: { initial: DayRange; onApply: (range: DayRange) => void; onClose: () => void }) {
  const today = isoDay(new Date());
  const [draft, setDraft] = useState<DayRange>(initial);
  const [view, setView] = useState(() => {
    const anchor = parse(initial.to || initial.from || today);
    return { year: anchor.getFullYear(), month: anchor.getMonth() };
  });

  const first = new Date(view.year, view.month, 1);
  const lead = (first.getDay() + 6) % 7;
  const length = new Date(view.year, view.month + 1, 0).getDate();
  const cells = [...Array<null>(lead).fill(null), ...Array.from({ length }, (_, index) => isoDay(new Date(view.year, view.month, index + 1)))];
  const atToday = view.year === new Date().getFullYear() && view.month === new Date().getMonth();

  const shift = (step: number) => {
    const next = new Date(view.year, view.month + step, 1);
    setView({ year: next.getFullYear(), month: next.getMonth() });
  };

  const tap = (day: string) => {
    if (!draft.from || draft.to) return setDraft({ from: day, to: "" });
    setDraft(day < draft.from ? { from: day, to: draft.from } : { from: draft.from, to: day });
  };

  const preset = (from: Date, to: Date) => {
    const end = isoDay(to) > today ? today : isoDay(to);
    setDraft({ from: isoDay(from), to: end });
    setView({ year: from.getFullYear(), month: from.getMonth() });
  };
  const now = new Date();

  return (
    <div className="w-full select-none">
      <div className="flex items-center gap-1">
        <button type="button" className={chip} onClick={() => preset(new Date(now.getFullYear(), now.getMonth(), 1), now)}>
          Цей місяць
        </button>
        <button type="button" className={chip} onClick={() => preset(new Date(now.getFullYear(), now.getMonth() - 1, 1), new Date(now.getFullYear(), now.getMonth(), 0))}>
          Минулий місяць
        </button>
        <button type="button" className={chip} onClick={() => preset(new Date(now.getFullYear(), 0, 1), now)}>
          Цей рік
        </button>
        <button type="button" aria-label="Закрити" onClick={onClose} className={`ml-auto flex size-8 shrink-0 items-center justify-center rounded-md text-lg leading-none ${muted} hover:text-foreground`}>
          ×
        </button>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <button type="button" aria-label="Попередній місяць" onClick={() => shift(-1)} className={`flex size-9 items-center justify-center rounded-md text-xl leading-none ${muted} hover:bg-muted hover:text-foreground`}>
          ‹
        </button>
        <span className="text-sm font-semibold text-foreground">
          {MONTHS[view.month]} {view.year}
        </span>
        <button type="button" aria-label="Наступний місяць" disabled={atToday} onClick={() => shift(1)} className={`flex size-9 items-center justify-center rounded-md text-xl leading-none ${muted} hover:bg-muted hover:text-foreground disabled:opacity-25 disabled:hover:bg-transparent`}>
          ›
        </button>
      </div>

      <div className={`mt-1 grid grid-cols-7 text-center text-[10px] font-medium uppercase ${muted}`}>
        {WEEKDAYS.map((day) => (
          <span key={day} className="py-1">
            {day}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((day, index) => {
          if (!day) return <span key={`lead-${index}`} />;
          const end = draft.to || draft.from;
          const edge = day === draft.from || day === draft.to;
          const inside = Boolean(draft.from && day > draft.from && day < end);
          const future = day > today;
          const band = draft.from && draft.to && draft.from !== draft.to && (inside || edge);
          return (
            <span key={day} className="relative flex h-10 items-center justify-center">
              {band && <span className={`absolute inset-y-0 bg-foreground/10 ${day === draft.from ? "left-1/2 right-0" : day === draft.to ? "left-0 right-1/2" : "inset-x-0"}`} />}
              <button
                type="button"
                disabled={future}
                aria-label={label(day)}
                aria-pressed={edge}
                onClick={() => tap(day)}
                className={`relative size-10 rounded-md text-[13px] tabular-nums transition-colors ${edge ? "bg-foreground font-semibold text-background" : future ? `${muted} opacity-30` : "text-foreground hover:bg-muted"}`}
              >
                {Number(day.slice(8))}
                {day === today && <span className={`absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full ${edge ? "bg-background" : "bg-foreground/50"}`} />}
              </button>
            </span>
          );
        })}
      </div>

      <div className="mt-2 flex items-center gap-2 border-t border-border pt-2">
        <span className="flex-1 whitespace-nowrap text-xs tabular-nums text-foreground">
          {label(draft.from)} — {label(draft.to)}
        </span>
        <button type="button" onClick={() => setDraft({ from: "", to: "" })} className={`h-8 shrink-0 rounded-md px-1.5 text-xs ${muted} hover:text-foreground`}>
          Скинути
        </button>
        <button type="button" disabled={!draft.from || !draft.to} onClick={() => onApply(draft)} className="h-8 shrink-0 rounded-md bg-foreground px-3 text-xs font-semibold text-background disabled:opacity-30">
          Застосувати
        </button>
      </div>
    </div>
  );
}
