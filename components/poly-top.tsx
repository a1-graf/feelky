"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FxBalanceChart, type ChartRange } from "@/components/fx-balance-chart";
import { PolyBalanceBlock } from "@/components/poly-balance-block";
import { isoDay, RangeCalendar, type DayRange } from "@/components/range-calendar";
import type { FxBalancePoint } from "@/lib/fx-stats";

const DAY = 86_400_000;
const PERIODS = [
  { key: "7", title: "7 днів", span: 7 * DAY },
  { key: "30", title: "30 днів", span: 30 * DAY },
  { key: "90", title: "90 днів", span: 90 * DAY },
  { key: "ALL", title: "Весь час", span: Infinity },
  { key: "CT", title: "Свій час", span: 0 }
] as const;
type PeriodKey = (typeof PERIODS)[number]["key"];

const dayStart = (value: string) => (value ? new Date(`${value}T00:00:00`).getTime() : NaN);
const dayEnd = (value: string) => (value ? new Date(`${value}T23:59:59.999`).getTime() : NaN);
const muted = "text-[hsl(var(--card-muted-foreground))]";

/**
 * Top card of /poly: a strip of small square period buttons drives both charts (PnL and the balance shown on hover); the figure tiles stay all-time.
 * CT opens a range calendar: a popover under the strip on wide screens, a bottom sheet over a dimmed page on phones, so the grid never moves. `stats` and `turnover` are rendered on the server and only placed here.
 */
export function PolyTop({ balance, balanceSeries, pnlSeries, currency, hidden, stats, turnover }: { balance: string; balanceSeries: FxBalancePoint[]; pnlSeries: FxBalancePoint[]; currency: string; hidden: boolean; stats: React.ReactNode; turnover: React.ReactNode }) {
  const [period, setPeriod] = useState<PeriodKey>("30");
  const [custom, setCustom] = useState<DayRange>({ from: "", to: "" });
  const [picking, setPicking] = useState(false);
  const [wide, setWide] = useState(true);
  const [now] = useState(() => Date.now());
  const strip = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 640px)");
    const sync = () => setWide(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!picking) return;
    const close = (event: PointerEvent) => !strip.current?.contains(event.target as Node) && !panel.current?.contains(event.target as Node) && setPicking(false);
    const escape = (event: KeyboardEvent) => event.key === "Escape" && setPicking(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [picking]);

  const range = useMemo<ChartRange>(() => {
    if (period === "CT") {
      return { start: Number.isNaN(dayStart(custom.from)) ? -Infinity : dayStart(custom.from), end: Number.isNaN(dayEnd(custom.to)) ? now : dayEnd(custom.to) };
    }
    return { start: now - PERIODS.find((item) => item.key === period)!.span, end: now };
  }, [period, custom, now]);

  const pick = (key: PeriodKey) => {
    if (key !== "CT") {
      setPeriod(key);
      setPicking(false);
      return;
    }
    setPicking((open) => !open);
  };

  const first = Math.min(...balanceSeries.map((point) => point.t), ...pnlSeries.map((point) => point.t), now);
  const initial: DayRange = { from: isoDay(new Date(Math.max(range.start, first))), to: isoDay(new Date(Math.min(range.end, now))) };
  const apply = (next: DayRange) => {
    setCustom(next);
    setPeriod("CT");
    setPicking(false);
  };
  const calendar = picking && <RangeCalendar initial={initial} onApply={apply} onClose={() => setPicking(false)} />;

  return (
    <>
      <div ref={strip} className="relative mb-2 flex gap-1 sm:mb-2.5">
        {PERIODS.map((item) => (
          <button
            key={item.key}
            type="button"
            title={item.title}
            aria-label={item.title}
            aria-pressed={period === item.key}
            aria-expanded={item.key === "CT" ? picking : undefined}
            onClick={() => pick(item.key)}
            className={`flex size-8 items-center justify-center rounded-md text-[11px] font-semibold tabular-nums transition-colors ${period === item.key ? "bg-foreground text-background" : `bg-muted ${muted} hover:text-foreground`}`}
          >
            {item.key}
          </button>
        ))}
        {calendar && wide && (
          <div ref={panel} role="dialog" aria-label="Свій період" className="absolute left-0 top-full z-30 mt-1.5 w-[23rem] rounded-xl border border-border bg-card p-3 shadow-lg">
            {calendar}
          </div>
        )}
        {calendar &&
          !wide &&
          createPortal(
            <div ref={panel} onClick={(event) => event.target === event.currentTarget && setPicking(false)} className="fixed inset-0 z-50 flex items-end bg-black/60">
              <div role="dialog" aria-label="Свій період" className="w-full rounded-t-2xl border-t border-border bg-card px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-lg">
                {calendar}
              </div>
            </div>,
            document.body
          )}
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
        <PolyBalanceBlock balance={balance} series={balanceSeries} currency={currency} hidden={hidden} range={range} />
        {stats}
        <FxBalanceChart data={pnlSeries} currency={currency} oneR={0} hidden={hidden} title="PnL" showTotal={false} range={range} ticks />
        {turnover}
      </div>
    </>
  );
}
