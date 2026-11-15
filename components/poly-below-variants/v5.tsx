"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { formatPlain } from "@/lib/money";
import { cn } from "@/lib/ui";
import type { BelowData, BelowRow } from "./data";
import type { BreakdownKey } from "./labels";
import {
  BarsList,
  cumulative,
  EmptySlots,
  L,
  LockLine,
  money,
  muted,
  pct,
  pfText,
  ReconcileAlert,
  RowsLegend,
  rowLine,
  signed,
  signedPct,
  Sparkline,
  tone,
  TradeFeed,
  trades,
} from "./shared";

function Tile({
  label,
  value,
  valueClass,
  children,
  className,
}: {
  label: string;
  value: React.ReactNode;
  valueClass?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("flex min-w-0 flex-col rounded-xl bg-muted p-3", className)}
    >
      <div className={`text-[11px] leading-tight ${muted}`}>{label}</div>
      <div
        className={cn(
          "mt-1 text-base font-bold tabular-nums sm:text-lg",
          valueClass,
        )}
      >
        {value}
      </div>
      {children ? <div className="mt-auto pt-2">{children}</div> : null}
    </div>
  );
}

function Split({
  left,
  right,
  leftClass,
  rightClass,
}: {
  left: number;
  right: number;
  leftClass: string;
  rightClass: string;
}) {
  const total = left + right;
  const share = total > 0 ? (left / total) * 100 : 50;
  return (
    <div className="flex h-1.5 overflow-hidden rounded-full bg-foreground/10">
      {total > 0 ? (
        <>
          <i
            className={cn("block h-full", leftClass)}
            style={{ width: `${share}%` }}
          />
          <i
            className={cn("block h-full", rightClass)}
            style={{ width: `${100 - share}%` }}
          />
        </>
      ) : null}
    </div>
  );
}

type Cut = BreakdownKey;
const CUTS: Array<{ key: Cut; label: string }> = [
  { key: "market", label: "Ринок" },
  { key: "price", label: "Ціна" },
  { key: "hour", label: "Години" },
  { key: "week", label: "Тижні" },
  { key: "day", label: "Дні" },
];
const CUT_HINTS: Record<Cut, string> = {
  market: "Результат за типом ринку",
  price: "Результат за ціною входу (у центах за частку)",
  hour: "Година відкриття за UTC (Київ = UTC+2); колір — результат, число — угод",
  week: "Тижні з понеділка, нові зверху",
  day: "Останні 10 днів з угодами",
};

function HourGrid({ rows, hidden }: { rows: BelowRow[]; hidden: boolean }) {
  const byHour = new Map(rows.map((row) => [row.name, row]));
  const max = Math.max(...rows.map((row) => Math.abs(Number(row.pnl))), 0.01);
  const [selected, setSelected] = useState<string | null>(
    rows[0]?.name ?? null,
  );
  const current = selected ? byHour.get(selected) : undefined;
  return (
    <div>
      <div className="grid grid-cols-8 gap-1 md:grid-cols-12">
        {Array.from({ length: 24 }, (_, hour) => {
          const name = String(hour).padStart(2, "0");
          const row = byHour.get(name);
          const value = row ? Number(row.pnl) : 0;
          const alpha = row ? 0.25 + (Math.abs(value) / max) * 0.75 : 0;
          return (
            <button
              key={name}
              type="button"
              disabled={!row}
              onClick={() => setSelected(name)}
              className={cn(
                "flex h-11 flex-col items-center justify-center rounded-md text-[10px] tabular-nums",
                row
                  ? "font-semibold text-white"
                  : `bg-foreground/[0.05] ${muted}`,
                selected === name && "ring-2 ring-foreground/70",
              )}
              style={
                row
                  ? {
                      backgroundColor:
                        value >= 0
                          ? `hsl(142 60% 40% / ${alpha})`
                          : `hsl(0 75% 55% / ${alpha})`,
                    }
                  : undefined
              }
            >
              <span>{name}</span>
              <span className="font-normal opacity-80">
                {row ? row.count : "·"}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-2 rounded-md bg-background/50 px-2.5 py-1.5 text-xs">
        {current ? (
          <>
            <div className="flex justify-between gap-2">
              <span className="font-semibold">{current.label} UTC</span>
              <span
                className={cn(
                  "font-semibold tabular-nums",
                  !hidden && tone(current.pnl),
                )}
              >
                {signed(current.pnl, hidden)}
              </span>
            </div>
            <div className={muted}>{rowLine(current, hidden)}</div>
          </>
        ) : (
          <span className={muted}>Торкнись години</span>
        )}
      </div>
    </div>
  );
}

/** Variant 5 — dashboard: a grid of dense tiles with small indicators, breakdowns in one switchable block, then trades. */
export function BelowV5({ data }: { data: BelowData }) {
  const { hidden, metrics: m } = data;
  const [cut, setCut] = useState<Cut>("market");
  const lines = useMemo(
    () => ({
      MANUAL: cumulative(
        data.trades.filter((trade) => trade.section === "MANUAL"),
      ),
      COPYTRADE: cumulative(
        data.trades.filter((trade) => trade.section === "COPYTRADE"),
      ),
      AI_AGENT: cumulative(
        data.trades.filter((trade) => trade.section === "AI_AGENT"),
      ),
    }),
    [data.trades],
  );
  const free = Math.max(0, Number(m.poolBalance));
  const locked = Math.max(0, Number(m.lockedPrincipal));
  const pf = m.profitFactor == null ? null : Number(m.profitFactor);
  const feeShare =
    Number(m.turnover) > 0 ? (Number(m.fees) / Number(m.turnover)) * 100 : 0;

  return (
    <>
      <ReconcileAlert data={data} className="mt-4" />
      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        <Tile
          label={L.pool}
          value={money(m.poolTotal, hidden)}
          className="col-span-2"
        >
          <Split
            left={free}
            right={locked}
            leftClass="bg-success"
            rightClass="bg-[hsl(38_90%_58%)]"
          />
          <div
            className={`mt-1 flex justify-between gap-2 text-[11px] ${muted}`}
          >
            <span>вільно {money(m.poolBalance, hidden)}</span>
            <span>заблоковано {money(m.lockedPrincipal, hidden)}</span>
          </div>
        </Tile>
        <Tile
          label={L.pf}
          value={pfText(data)}
          valueClass={
            hidden || pf == null ? "" : pf >= 1 ? "text-success" : "text-danger"
          }
        >
          <div className="relative h-1.5 rounded-full bg-foreground/10">
            <i
              className={cn(
                "absolute inset-y-0 left-0 rounded-full",
                pf != null && pf >= 1 ? "bg-success" : "bg-danger",
              )}
              style={{ width: `${Math.min(100, ((pf ?? 0) / 2) * 100)}%` }}
            />
            <i className="absolute -inset-y-1 left-1/2 w-px bg-foreground/60" />
          </div>
          <div className={`mt-1 text-[11px] ${muted}`}>
            риска — 1, вище — у плюсі
          </div>
        </Tile>
        <Tile label={L.winRate} value={pct(m.winRate, hidden)}>
          <Split
            left={m.wins}
            right={m.losses}
            leftClass="bg-success"
            rightClass="bg-danger"
          />
          <div className={`mt-1 text-[11px] ${muted}`}>
            {m.wins} виграшів · {m.losses} програшів
          </div>
        </Tile>
        <Tile
          label={L.roi}
          value={signedPct(m.roi, hidden)}
          valueClass={hidden ? "" : tone(m.roi)}
        >
          <div className={`text-[11px] ${muted}`}>
            прибуток до обороту {money(m.turnover, hidden)}
          </div>
        </Tile>
        <Tile label={L.fees} value={money(m.fees, hidden)}>
          <div className={`text-[11px] ${muted}`}>
            {hidden ? "••••" : `${formatPlain(feeShare)}%`} від обороту
          </div>
        </Tile>
        <Tile label={L.open} value={money(m.openExposure, hidden)}>
          <div className={`text-[11px] ${muted}`}>
            відкритих угод: {m.openCount}
          </div>
        </Tile>
        <Tile
          label="Середній виграш / програш"
          value={
            hidden
              ? "••••"
              : `${formatPlain(m.avgWin)} / ${formatPlain(m.avgLoss)}`
          }
        >
          <Split
            left={Number(m.avgWin)}
            right={Number(m.avgLoss)}
            leftClass="bg-success"
            rightClass="bg-danger"
          />
        </Tile>

        {data.sources.map((source) => (
          <Tile
            key={source.key}
            label={source.label}
            value={signed(source.all.pnl, hidden)}
            valueClass={hidden ? "" : tone(source.all.pnl)}
          >
            <Sparkline values={lines[source.key]} />
            <div className={`mt-1 text-[11px] leading-tight ${muted}`}>
              {rowLine(source.all, hidden)}
            </div>
            <div className={`text-[11px] leading-tight ${muted}`}>
              за {data.periodLabel}: {trades(source.period.count)}
              {source.period.openCount
                ? `, ${source.period.openCount} відкритих`
                : ""}{" "}
              · {signed(source.period.pnl, hidden)}
            </div>
          </Tile>
        ))}
        <Tile
          label={L.slippage}
          value={
            data.slippage.count
              ? money(`-${data.slippage.costUsd}`, hidden)
              : "—"
          }
          valueClass={data.slippage.count && !hidden ? "text-danger" : ""}
        >
          <div className={`text-[11px] leading-tight ${muted}`}>
            {data.slippage.count
              ? hidden
                ? "••••"
                : `різниця до сигналу ${formatPlain(data.slippage.avgPoints)} (${formatPlain(data.slippage.avgPercent)}%) · гірше за лідера ${data.slippage.worseCount} з ${data.slippage.count}`
              : "додай ціну сигналу до копі-угод"}
          </div>
        </Tile>

        <div className="col-span-2 rounded-xl bg-muted p-3 md:col-span-4">
          <div className="flex flex-col gap-x-2 sm:flex-row sm:items-baseline sm:justify-between">
            <span className="text-sm font-semibold">AI-агенти</span>
            <span className={`text-[11px] ${muted}`}>
              гроші заблоковані на 30 днів, до того — аналітика
            </span>
          </div>
          <div className="mt-2 grid gap-3 md:grid-cols-2">
            {data.agents.map((agent) => (
              <div key={agent.name} className="text-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-medium">{agent.name}</span>
                  <span
                    className={cn(
                      "shrink-0 font-semibold tabular-nums",
                      !hidden && tone(agent.pnl),
                    )}
                  >
                    {signed(agent.pnl, hidden)}
                  </span>
                </div>
                <div className={`text-[11px] ${muted}`}>
                  {trades(agent.count)} · вінрейт {pct(agent.winRate, hidden)} ·
                  аналітичний прибуток / збиток
                  {agent.releasedCount
                    ? ` · знято блокувань ${agent.releasedCount}, результат ${signed(agent.realized, hidden)}`
                    : ""}
                </div>
                <LockLine agent={agent} hidden={hidden} />
              </div>
            ))}
            <div className="self-end">
              <EmptySlots
                count={data.emptyAgentSlots}
                offset={data.agents.length}
              />
            </div>
          </div>
        </div>
      </div>

      <Card className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="font-semibold">Розрізи</div>
          <div className="flex w-full gap-1 rounded-lg bg-muted p-1 md:w-auto">
            {CUTS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setCut(item.key)}
                className={cn(
                  "min-w-0 flex-1 truncate rounded-md px-1 py-1.5 text-xs md:flex-none md:px-3",
                  cut === item.key
                    ? "bg-background font-semibold shadow-sm"
                    : muted,
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className={`mb-3 mt-2 text-xs ${muted}`}>{CUT_HINTS[cut]}</div>
        {cut === "hour" ? (
          <HourGrid rows={data.breakdowns.hour} hidden={hidden} />
        ) : (
          <BarsList rows={data.breakdowns[cut]} hidden={hidden} />
        )}
        <div className="mt-3">
          <RowsLegend />
        </div>
      </Card>

      <Card className="mt-4">
        <div className="mb-2 font-semibold">Усі угоди</div>
        <TradeFeed data={data} pageSize={20} filters="chips" />
      </Card>
    </>
  );
}
