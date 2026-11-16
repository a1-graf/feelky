"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/ui";
import type { BelowData } from "../poly-below-variants/data";
import { cumulative, ReconcileAlert } from "../poly-below-variants/shared";
import { best, LockStatus, CUTS, HAIR, Label, minorStats, money, muted, signed, slippageLine, tone } from "./kit";

type Cell = { key: string; label: React.ReactNode; value: React.ReactNode; cls?: string; sub?: React.ReactNode; line?: number[] };

/** Running result as a 1px grey line: the shape only, the figure above already carries the colour. */
function Line({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const min = Math.min(0, ...values);
  const span = Math.max(0, ...values) - min || 1;
  const y = (value: number) => 15 - ((value - min) / span) * 14;
  return (
    <svg viewBox="0 0 100 16" preserveAspectRatio="none" className="mt-2 h-4 w-full text-foreground/40" aria-hidden>
      <polyline
        points={values.map((value, index) => `${(index / (values.length - 1)) * 100},${y(value)}`).join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Two columns split by a hairline cross, like the four figures in the top card. */
function Grid({ cells }: { cells: Cell[] }) {
  return (
    <div className="grid grid-cols-2">
      {cells.map((cell, index) => (
        <div
          key={cell.key}
          className={cn("min-w-0 py-3", HAIR, index % 2 ? "border-l pl-4" : "pr-4", index > 1 && "border-t")}
        >
          <div className={cn("whitespace-nowrap text-[11px] leading-tight", muted)}>{cell.label}</div>
          <div className={cn("mt-1 truncate tabular-nums", cell.cls)}>{cell.value}</div>
          {cell.sub ? <div className={cn("mt-0.5 truncate text-[11px] leading-tight", muted)}>{cell.sub}</div> : null}
          {cell.line ? <Line values={cell.line} /> : null}
        </div>
      ))}
    </div>
  );
}

/** Minimal 5 — a grid of single figures with hairlines; sources get a thin result line, breakdowns only their best slice. */
export function BelowM5({ data }: { data: BelowData }) {
  const { hidden, metrics: m } = data;
  const slip = slippageLine(data);
  const summary: Cell[] = [
    {
      key: "pool",
      label: "Пул",
      value: money(m.poolTotal, hidden),
      sub: Number(m.lockedPrincipal) > 0 ? `${money(m.lockedPrincipal, hidden)} заблоковано` : null,
    },
    ...minorStats(data),
  ];
  const sources: Cell[] = data.sources.map((source) => ({
    key: source.key,
    label: source.label,
    value: signed(source.all.pnl, hidden),
    cls: hidden ? "" : tone(source.all.pnl),
    sub: source.key === "AI_AGENT" ? <LockStatus data={data} /> : null,
    line: hidden || source.key === "AI_AGENT" ? undefined : cumulative(data.trades.filter((trade) => trade.section === source.key)),
  }));
  if (slip) sources.push({ key: "slip", label: "Проковзування", value: slip.value, cls: hidden ? "" : "text-danger" });
  const cuts: Cell[] = CUTS.map(({ key, label }) => {
    const top = best(data.breakdowns[key]);
    return {
      key,
      label,
      value: top ? top.label : "—",
      sub: top ? <span className={hidden ? "" : tone(top.pnl)}>{signed(top.pnl, hidden)}</span> : null,
    };
  });
  return (
    <Card data-below="m5" className="mt-4 px-4 py-4">
      <ReconcileAlert data={data} className="mb-3" />
      <Grid cells={summary} />
      <Label className={cn("border-t pb-1 pt-4", HAIR)}>Джерела угод</Label>
      <Grid cells={sources} />
      <Label className={cn("border-t pb-1 pt-4", HAIR)}>Найкраще в розрізах</Label>
      <Grid cells={cuts} />
    </Card>
  );
}
