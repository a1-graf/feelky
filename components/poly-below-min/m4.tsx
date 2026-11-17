"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/ui";
import type { BelowData } from "../poly-below-variants/data";
import { ReconcileAlert } from "../poly-below-variants/shared";
import { Chevron, CUTS, DIV, HAIR, Label, minorStats, money, muted, Rows, Slippage, Sources, Trades } from "./kit";

/** Minimal 4 — a single line of figures, then the trades by day; all statistics fold into one line at the bottom. */
export function BelowM4({ data }: { data: BelowData }) {
  const [stats, setStats] = useState(false);
  const { hidden, metrics: m } = data;
  // Open exposure only matters while something is open.
  const figures = [
    { key: "pool", label: <>Пул</>, value: money(m.poolTotal, hidden), cls: "" },
    ...minorStats(data).filter((item) => item.key !== "open" || m.openCount > 0),
  ];
  return (
    <Card data-below="m4" className="mt-4 px-5 py-5">
      <ReconcileAlert data={data} className="mb-3" />
      <div className={cn("flex divide-x", DIV)}>
        {figures.map((item) => (
          <div key={item.key} className="min-w-0 flex-auto px-3 first:pl-0 last:pr-0">
            <div className={cn("whitespace-nowrap text-[11px] leading-tight", muted)}>{item.label}</div>
            <div className={cn("mt-0.5 text-sm tabular-nums", item.cls)}>{item.value}</div>
          </div>
        ))}
      </div>

      <div className="mb-2 mt-6 text-sm font-medium">Угоди</div>
      <Trades data={data} byDay pageSize={12} />

      <div className={cn("mt-3 border-t", HAIR)}>
        <button type="button" aria-expanded={stats} onClick={() => setStats(!stats)} className="flex w-full items-center gap-2 pt-3 text-left text-sm">
          <Chevron open={stats} className="size-3.5" />
          <span className="flex-1">Статистика</span>
          <span className={cn("text-xs", muted)}>джерела і розрізи</span>
        </button>
        {stats ? (
          <div className="pt-2">
            <Label className="mt-2">Джерела угод</Label>
            <Sources data={data} />
            <Slippage data={data} className={`border-t ${HAIR}`} />
            {CUTS.map(({ key, label }) => (
              <div key={key}>
                <Label className="mt-4">{label}</Label>
                <Rows rows={data.breakdowns[key]} hidden={hidden} />
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
