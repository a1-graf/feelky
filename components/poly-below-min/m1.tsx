"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/ui";
import type { BelowData } from "../poly-below-variants/data";
import { ReconcileAlert } from "../poly-below-variants/shared";
import { best, Chevron, CUTS, DIV, HAIR, Minor, muted, PoolHero, Rows, signed, slippageLine, Sources, tone, Trades } from "./kit";

function Fold({ title, summary, open: initial = false, children }: { title: string; summary: React.ReactNode; open?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(initial);
  return (
    <div>
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 py-3 text-left text-sm">
        <Chevron open={open} className="size-3.5" />
        <span className="flex-1">{title}</span>
        <span className="tabular-nums">{summary}</span>
      </button>
      {open ? <div className="pb-2 pl-5">{children}</div> : null}
    </div>
  );
}

/** Minimal 1 — one big figure, three small ones, then one-line folds separated by hairlines. */
export function BelowM1({ data }: { data: BelowData }) {
  const { hidden, metrics } = data;
  const slip = slippageLine(data);
  return (
    <Card data-below="m1" className="mt-4 px-5 py-5">
      <ReconcileAlert data={data} className="mb-3" />
      <PoolHero data={data} />
      <Minor data={data} className="mt-5" />
      <div className={cn("mt-4 divide-y border-t", HAIR, DIV)}>
        <Fold title="Джерела угод" open summary={<span className={hidden ? "" : tone(metrics.totalPnl)}>{signed(metrics.totalPnl, hidden)}</span>}>
          <Sources data={data} />
        </Fold>
        {CUTS.map(({ key, label }) => {
          const top = best(data.breakdowns[key]);
          return (
            <Fold key={key} title={label} summary={<span className={muted}>{top ? `найкраще ${top.label}` : "порожньо"}</span>}>
              <Rows rows={data.breakdowns[key]} hidden={hidden} />
            </Fold>
          );
        })}
        {slip ? (
          <Fold title="Проковзування" summary={<span className={hidden ? "" : "text-danger"}>{slip.value}</span>}>
            <div className={cn("pb-1 text-xs", muted)}>Копітрейд: {slip.sub}</div>
          </Fold>
        ) : null}
        <Fold title="Угоди" summary={<span className={muted}>{data.trades.length}</span>}>
          <Trades data={data} />
        </Fold>
      </div>
    </Card>
  );
}
