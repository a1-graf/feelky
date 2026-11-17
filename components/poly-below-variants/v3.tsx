"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { formatPlain } from "@/lib/money";
import { cn } from "@/lib/ui";
import type { BelowData, BelowRow } from "./data";
import { BREAKDOWN_TITLES } from "./labels";
import {
  AgentsList,
  BarsList,
  L,
  money,
  muted,
  pct,
  pfText,
  ReconcileAlert,
  RowsLegend,
  rowLine,
  signed,
  signedPct,
  SlippageBlock,
  tone,
  TradeFeed,
  trades,
} from "./shared";

const SOURCE_COLORS = {
  MANUAL: "hsl(199 80% 58%)",
  COPYTRADE: "hsl(265 70% 68%)",
  AI_AGENT: "hsl(38 90% 58%)",
} as const;

function Line({
  label,
  value,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="flex items-baseline gap-2 py-1 text-sm">
      <span className={`min-w-0 ${muted}`}>{label}</span>
      <span className="min-w-4 flex-1 translate-y-[-3px] border-b border-dotted border-foreground/20" />
      <span className={cn("shrink-0 font-semibold tabular-nums", className)}>
        {value}
      </span>
    </div>
  );
}

/** Columns around a zero line, one per period; tap a column to read it. */
function Columns({
  rows,
  hidden,
  every = 1,
  title,
}: {
  rows: BelowRow[];
  hidden: boolean;
  every?: number;
  title: string;
}) {
  const withTrades = rows.filter((row) => row.count > 0);
  const [selected, setSelected] = useState<string | null>(
    withTrades.length ? withTrades[withTrades.length - 1].name : null,
  );
  const max = Math.max(...rows.map((row) => Math.abs(Number(row.pnl))), 0.01);
  const current = rows.find((row) => row.name === selected);
  return (
    <div>
      <div className="mb-2 text-sm font-semibold">{title}</div>
      {withTrades.length ? (
        <>
          <div className="flex h-20 items-stretch gap-[2px]">
            {rows.map((row) => {
              const value = Number(row.pnl);
              const height = `${(Math.abs(value) / max) * 50}%`;
              return (
                <button
                  key={row.name}
                  type="button"
                  aria-label={`${row.label}: ${signed(value, hidden)}`}
                  onClick={() => setSelected(row.name)}
                  className={cn(
                    "relative min-w-0 flex-1 rounded-sm",
                    selected === row.name
                      ? "bg-foreground/15"
                      : "hover:bg-foreground/5",
                  )}
                >
                  <i className="absolute inset-x-0 top-1/2 h-px bg-foreground/20" />
                  {row.count ? (
                    <i
                      className={cn(
                        "absolute inset-x-[15%] rounded-[2px]",
                        value >= 0
                          ? "bottom-1/2 bg-success"
                          : "top-1/2 bg-danger",
                      )}
                      style={{ height: value === 0 ? "2px" : height }}
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
          <div className="mt-1 flex gap-[2px]">
            {rows.map((row, index) => (
              <span
                key={row.name}
                className={`min-w-0 flex-1 overflow-visible whitespace-nowrap text-center text-[9px] tabular-nums ${muted}`}
              >
                {index % every === 0 ? row.label.split(/[–:]/)[0] : ""}
              </span>
            ))}
          </div>
          <div className="mt-2 min-h-9 rounded-md bg-muted px-2.5 py-1.5 text-xs">
            {current ? (
              <>
                <div className="flex justify-between gap-2">
                  <span className="font-semibold">{current.label}</span>
                  <span
                    className={cn(
                      "font-semibold tabular-nums",
                      !hidden && tone(current.pnl),
                    )}
                  >
                    {signed(current.pnl, hidden)}
                  </span>
                </div>
                <div className={muted}>
                  {current.count ? rowLine(current, hidden) : "угод не було"}
                </div>
              </>
            ) : (
              <span className={muted}>Торкнись стовпчика</span>
            )}
          </div>
        </>
      ) : (
        <div className={`text-sm ${muted}`}>Поки порожньо</div>
      )}
    </div>
  );
}

/** Variant 3 — one summary block, then every breakdown as a chart: bars for categories, columns for time. */
export function BelowV3({ data }: { data: BelowData }) {
  const { hidden, metrics: m } = data;
  const total = data.sources.reduce((sum, source) => sum + source.all.count, 0);
  const free = Number(m.poolBalance);
  const locked = Number(m.lockedPrincipal);
  const freeShare =
    free + locked > 0
      ? (Math.max(0, free) / (Math.max(0, free) + locked)) * 100
      : 100;
  const hours: BelowRow[] = Array.from({ length: 24 }, (_, hour) => {
    const name = String(hour).padStart(2, "0");
    return (
      data.breakdowns.hour.find((row) => row.name === name) ?? {
        name,
        label: `${name}:00`,
        count: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        roi: "0",
        pnl: "0",
      }
    );
  });

  return (
    <>
      <Card className="mt-4">
        <ReconcileAlert data={data} className="mb-3" />
        <div className="grid gap-4 md:grid-cols-2 md:gap-8">
          <div>
            <div className={`text-xs ${muted}`}>{L.pool}</div>
            <div className="text-2xl font-bold tabular-nums">
              {money(m.poolTotal, hidden)}
            </div>
            <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-foreground/10">
              <i
                className="block h-full bg-success"
                style={{ width: `${freeShare}%` }}
              />
              <i
                className="block h-full bg-[hsl(38_90%_58%)]"
                style={{ width: `${100 - freeShare}%` }}
              />
            </div>
            <div className={`mt-1 flex justify-between text-xs ${muted}`}>
              <span>
                <i className="mr-1 inline-block size-2 rounded-full bg-success" />
                вільно {money(m.poolBalance, hidden)}
              </span>
              <span>
                <i className="mr-1 inline-block size-2 rounded-full bg-[hsl(38_90%_58%)]" />
                заблоковано {money(m.lockedPrincipal, hidden)}
              </span>
            </div>
            <div className="mt-3">
              <Line
                label={L.open}
                value={`${money(m.openExposure, hidden)} · ${m.openCount}`}
              />
              <Line
                label={L.pf}
                value={pfText(data)}
                className={
                  !hidden && m.profitFactor != null
                    ? Number(m.profitFactor) >= 1
                      ? "text-success"
                      : "text-danger"
                    : ""
                }
              />
              <Line label={L.fees} value={money(m.fees, hidden)} />
              <Line
                label="Сума виграшів"
                value={signed(m.grossProfit, hidden)}
                className={hidden ? "" : "text-success"}
              />
              <Line
                label="Сума програшів"
                value={signed(`-${m.grossLoss}`, hidden)}
                className={hidden ? "" : "text-danger"}
              />
              <Line
                label="Середній виграш / програш"
                value={
                  hidden
                    ? "••••"
                    : `${formatPlain(m.avgWin)} / ${formatPlain(m.avgLoss)}`
                }
              />
            </div>
          </div>

          <div>
            <div className="mb-2 text-sm font-semibold">
              Джерела угод · частка угод
            </div>
            <div className="flex h-3 overflow-hidden rounded-full bg-foreground/10">
              {data.sources.map((source) =>
                source.all.count ? (
                  <i
                    key={source.key}
                    className="block h-full"
                    style={{
                      width: `${(source.all.count / Math.max(1, total)) * 100}%`,
                      backgroundColor: SOURCE_COLORS[source.key],
                    }}
                  />
                ) : null,
              )}
            </div>
            <div className="mt-2 divide-y divide-foreground/10">
              {data.sources.map((source) => (
                <div key={source.key} className="py-1.5 text-sm">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="flex items-center gap-1.5 font-medium">
                      <i
                        className="size-2.5 rounded-full"
                        style={{ backgroundColor: SOURCE_COLORS[source.key] }}
                      />
                      {source.label}
                    </span>
                    <span
                      className={cn(
                        "font-semibold tabular-nums",
                        !hidden && tone(source.all.pnl),
                      )}
                    >
                      {signed(source.all.pnl, hidden)}
                    </span>
                  </div>
                  <div className={`text-xs ${muted}`}>
                    {trades(source.all.count)} · вінрейт{" "}
                    {pct(source.all.winRate, hidden)} · рентабельність{" "}
                    {signedPct(source.all.roi, hidden)}
                  </div>
                  <div className={`text-xs ${muted}`}>
                    За {data.periodLabel}: {trades(source.period.count)}
                    {source.period.openCount
                      ? ` · ${source.period.openCount} відкритих`
                      : ""}{" "}
                    · {signed(source.period.pnl, hidden)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Card className="mt-4">
        <div className="mb-3 font-semibold">Де заробляє і де втрачає</div>
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <div className="mb-2 text-sm font-semibold">
              {BREAKDOWN_TITLES.market}
            </div>
            <BarsList rows={data.breakdowns.market} hidden={hidden} />
          </div>
          <div>
            <div className="mb-2 text-sm font-semibold">
              {BREAKDOWN_TITLES.price}
            </div>
            <BarsList rows={data.breakdowns.price} hidden={hidden} />
          </div>
          <Columns
            title={BREAKDOWN_TITLES.hour}
            rows={hours}
            hidden={hidden}
            every={3}
          />
          <Columns
            title="По днях (останні 10)"
            rows={[...data.breakdowns.day].reverse()}
            hidden={hidden}
          />
          <Columns
            title={BREAKDOWN_TITLES.week}
            rows={[...data.breakdowns.week].reverse()}
            hidden={hidden}
          />
          <div>
            <div className="mb-2 text-sm font-semibold">{L.slippage}</div>
            <SlippageBlock data={data} />
          </div>
        </div>
        <div className="mt-3">
          <RowsLegend />
        </div>
      </Card>

      <Card className="mt-4">
        <div className="mb-2 font-semibold">AI-агенти</div>
        <AgentsList data={data} />
      </Card>

      <Card className="mt-4">
        <div className="mb-2 font-semibold">Усі угоди</div>
        <TradeFeed data={data} pageSize={10} filters="chips" />
      </Card>
    </>
  );
}
