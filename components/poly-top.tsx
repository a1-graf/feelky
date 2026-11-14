"use client";

import { useMemo, useState } from "react";
import { FxBalanceChart, type ChartRange } from "@/components/fx-balance-chart";
import { PolyBalanceBlock } from "@/components/poly-balance-block";
import type { FxBalancePoint } from "@/lib/fx-stats";

const DAY = 86_400_000;
const PERIODS = [
  { key: "7d", label: "7 днів", span: 7 * DAY },
  { key: "1m", label: "1 місяць", span: 30 * DAY },
  { key: "3m", label: "3 місяці", span: 90 * DAY },
  { key: "all", label: "Весь час", span: Infinity },
  { key: "custom", label: "Свій час", span: 0 }
] as const;
type PeriodKey = (typeof PERIODS)[number]["key"];

const dayStart = (value: string) => (value ? new Date(`${value}T00:00:00`).getTime() : NaN);
const dayEnd = (value: string) => (value ? new Date(`${value}T23:59:59.999`).getTime() : NaN);
const field = "min-w-0 rounded-md border border-border bg-background px-1.5 py-1 text-xs";

/**
 * Top card of /poly: one period switcher drives both charts (PnL and the balance shown on hover); the figure tiles stay all-time.
 * `stats` and `turnover` are rendered on the server and only placed here.
 */
export function PolyTop({ balance, balanceSeries, pnlSeries, currency, hidden, stats, turnover }: { balance: string; balanceSeries: FxBalancePoint[]; pnlSeries: FxBalancePoint[]; currency: string; hidden: boolean; stats: React.ReactNode; turnover: React.ReactNode }) {
  const [period, setPeriod] = useState<PeriodKey>("1m");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [now] = useState(() => Date.now());

  const range = useMemo<ChartRange>(() => {
    if (period === "custom") {
      return { start: Number.isNaN(dayStart(from)) ? -Infinity : dayStart(from), end: Number.isNaN(dayEnd(to)) ? now : dayEnd(to) };
    }
    return { start: now - PERIODS.find((item) => item.key === period)!.span, end: now };
  }, [period, from, to, now]);

  return (
    <>
      <div className="mb-2.5 flex gap-1 sm:mb-3">
        {PERIODS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setPeriod(item.key)}
            className={`min-w-0 flex-1 whitespace-nowrap rounded-md px-1 py-1 text-[11px] font-semibold leading-4 transition-colors sm:flex-none sm:px-2 sm:text-xs ${period === item.key ? "bg-foreground text-background" : "bg-muted text-[hsl(var(--card-muted-foreground))] hover:text-foreground"}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      {period === "custom" && (
        <div className="mb-2.5 grid grid-cols-2 gap-1.5 sm:mb-3 sm:flex">
          <label className="flex min-w-0 items-center gap-1 text-xs text-[hsl(var(--card-muted-foreground))]">
            Від
            <input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} className={`${field} flex-1`} />
          </label>
          <label className="flex min-w-0 items-center gap-1 text-xs text-[hsl(var(--card-muted-foreground))]">
            До
            <input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} className={`${field} flex-1`} />
          </label>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
        <PolyBalanceBlock balance={balance} series={balanceSeries} currency={currency} hidden={hidden} range={range} />
        {stats}
        <FxBalanceChart data={pnlSeries} currency={currency} oneR={0} hidden={hidden} title="PnL" showTotal={false} range={range} />
        {turnover}
      </div>
    </>
  );
}
