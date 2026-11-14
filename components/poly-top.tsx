"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FxBalanceChart, type ChartRange } from "@/components/fx-balance-chart";
import { PolyBalanceBlock } from "@/components/poly-balance-block";
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
const field = "w-full min-w-0 rounded-md border border-border bg-background px-1.5 py-1 text-xs text-foreground";

/**
 * Top card of /poly: a strip of small square period buttons drives both charts (PnL and the balance shown on hover); the figure tiles stay all-time.
 * CT opens a small popover with two dates laid over the card, so the grid never moves. `stats` and `turnover` are rendered on the server and only placed here.
 */
export function PolyTop({ balance, balanceSeries, pnlSeries, currency, hidden, stats, turnover }: { balance: string; balanceSeries: FxBalancePoint[]; pnlSeries: FxBalancePoint[]; currency: string; hidden: boolean; stats: React.ReactNode; turnover: React.ReactNode }) {
  const [period, setPeriod] = useState<PeriodKey>("30");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [draft, setDraft] = useState({ from: "", to: "" });
  const [picking, setPicking] = useState(false);
  const [now] = useState(() => Date.now());
  const strip = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!picking) return;
    const close = (event: PointerEvent) => !strip.current?.contains(event.target as Node) && setPicking(false);
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
    setDraft(custom);
    setPicking((open) => !open);
  };

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
        {picking && (
          <form
            className="absolute left-0 top-full z-30 mt-1.5 w-52 rounded-lg border border-border bg-card p-2 shadow-lg"
            onSubmit={(event) => {
              event.preventDefault();
              setCustom(draft);
              setPeriod("CT");
              setPicking(false);
            }}
          >
            <div className={`grid grid-cols-[auto_1fr] items-center gap-x-1.5 gap-y-1 text-[11px] ${muted}`}>
              з
              <input type="date" aria-label="Початок" value={draft.from} max={draft.to || undefined} onChange={(event) => setDraft({ ...draft, from: event.target.value })} className={field} />
              по
              <input type="date" aria-label="Кінець" value={draft.to} min={draft.from || undefined} onChange={(event) => setDraft({ ...draft, to: event.target.value })} className={field} />
            </div>
            <button type="submit" className="mt-1.5 w-full rounded-md bg-foreground py-1 text-xs font-semibold text-background">
              Застосувати
            </button>
          </form>
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
