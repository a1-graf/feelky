"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/ui";
import type { BelowData } from "./data";
import { BREAKDOWN_TITLES } from "./labels";
import type { BreakdownKey } from "./labels";
import {
  AgentsList,
  headline,
  L,
  muted,
  ReconcileAlert,
  RowsLegend,
  rowLine,
  RowsList,
  signed,
  SlippageBlock,
  Stat,
  tone,
  TradeFeed,
  trades,
} from "./shared";

type Tab = "overview" | "cuts" | "trades";
type Cut = BreakdownKey | "slippage";
const CUTS: Array<{ key: Cut; label: string }> = [
  { key: "market", label: "Тип ринку" },
  { key: "price", label: "Ціна входу" },
  { key: "hour", label: "Години" },
  { key: "week", label: "Тижні" },
  { key: "day", label: "Дні" },
  { key: "slippage", label: "Проковзування" },
];

/** Variant 2 — tabs: overview, breakdowns and trades share one card; only one is on screen at a time. */
export function BelowV2({ data }: { data: BelowData }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [cut, setCut] = useState<Cut>("market");
  const { hidden } = data;
  const tabs: Array<{ key: Tab; label: string; badge?: string }> = [
    { key: "overview", label: "Огляд" },
    { key: "cuts", label: "Розрізи" },
    { key: "trades", label: "Угоди", badge: String(data.trades.length) },
  ];

  return (
    <Card className="mt-4">
      <ReconcileAlert data={data} className="mb-3" />
      <div
        role="tablist"
        className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1"
      >
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            onClick={() => setTab(item.key)}
            className={cn(
              "rounded-lg py-2 text-sm transition-colors",
              tab === item.key
                ? "bg-background font-semibold shadow-sm"
                : muted,
            )}
          >
            {item.label}
            {item.badge ? (
              <span className={`ml-1 text-xs ${muted}`}>{item.badge}</span>
            ) : null}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <div className="mt-3 grid gap-4">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {headline(data).map((item) => (
              <Stat
                key={item.key}
                label={item.label}
                value={item.value}
                hint={item.hint}
                valueClass={item.valueClass}
              />
            ))}
          </div>
          <div>
            <div className="mb-1 text-sm font-semibold">
              Джерела угод · за весь час
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              {data.sources.map((source) => (
                <div
                  key={source.key}
                  className="rounded-lg bg-muted px-3 py-2 text-sm"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold">{source.label}</span>
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
                    {rowLine(source.all, hidden)}
                  </div>
                  <div className={`text-xs ${muted}`}>
                    За {data.periodLabel}: {trades(source.period.count)}
                    {source.period.openCount
                      ? ` · ${source.period.openCount} відкритих`
                      : ""}{" "}
                    ·{" "}
                    <span className={hidden ? "" : tone(source.period.pnl)}>
                      {signed(source.period.pnl, hidden)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1 text-sm font-semibold">AI-агенти</div>
            <AgentsList data={data} />
          </div>
        </div>
      ) : null}

      {tab === "cuts" ? (
        <div className="mt-3">
          <div className="flex flex-wrap gap-1.5">
            {CUTS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setCut(item.key)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs",
                  cut === item.key
                    ? "bg-foreground font-semibold text-background"
                    : "bg-muted",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="mt-3 text-sm font-semibold">
            {cut === "slippage" ? L.slippage : BREAKDOWN_TITLES[cut]}
          </div>
          <div className="mt-1">
            {cut === "slippage" ? (
              <SlippageBlock data={data} />
            ) : (
              <>
                <RowsList rows={data.breakdowns[cut]} hidden={hidden} />
                <RowsLegend />
              </>
            )}
          </div>
        </div>
      ) : null}

      {tab === "trades" ? (
        <div className="mt-3">
          <TradeFeed data={data} pageSize={25} />
        </div>
      ) : null}
    </Card>
  );
}
