"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/ui";
import type { BelowData } from "./data";
import { BREAKDOWN_TITLES } from "./labels";
import type { BreakdownKey } from "./labels";
import {
  AgentsList,
  Chevron,
  L,
  money,
  muted,
  pfText,
  ReconcileAlert,
  RowsLegend,
  RowsList,
  SlippageBlock,
  SourcesList,
  TradeFeed,
} from "./shared";

const ORDER: BreakdownKey[] = ["market", "price", "hour", "week", "day"];

function Pill({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="flex items-baseline gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs">
      <span className={muted}>{label}</span>
      <span className={cn("font-semibold tabular-nums", className)}>
        {value}
      </span>
    </div>
  );
}

/** Variant 4 — the trade feed comes first (grouped by day, filter chips, "show more"); statistics fold into one drawer below. */
export function BelowV4({ data }: { data: BelowData }) {
  const { hidden, metrics: m } = data;
  const [stats, setStats] = useState(false);
  const pf =
    m.profitFactor == null
      ? ""
      : Number(m.profitFactor) >= 1
        ? "text-success"
        : "text-danger";

  return (
    <>
      <Card className="mt-4">
        <ReconcileAlert data={data} className="mb-3" />
        <div className="mb-3 flex flex-wrap gap-1.5">
          <Pill label={L.pool} value={money(m.poolTotal, hidden)} />
          <Pill
            label="Відкритих"
            value={`${m.openCount} · ${money(m.openExposure, hidden)}`}
          />
          <Pill
            label="Профіт-фактор"
            value={pfText(data)}
            className={hidden ? "" : pf}
          />
          <Pill label={L.fees} value={money(m.fees, hidden)} />
        </div>
        <div className={`mb-3 text-[11px] ${muted}`}>
          Профіт-фактор — сума виграшів, поділена на суму програшів: більше 1
          означає плюс. Вільно в пулі {money(m.poolBalance, hidden)},
          заблоковано в AI-агентах {money(m.lockedPrincipal, hidden)}.
        </div>
        <div className="mb-2 font-semibold">Угоди по днях</div>
        <TradeFeed data={data} pageSize={20} filters="full" groupByDay />
      </Card>

      <Card className="mt-4 py-1">
        <button
          type="button"
          aria-expanded={stats}
          onClick={() => setStats(!stats)}
          className="flex w-full items-center gap-2 py-3 text-left"
        >
          <Chevron open={stats} />
          <span className="flex-1">
            <span className="block font-semibold">Статистика</span>
            <span className={`block text-xs ${muted}`}>
              джерела, AI-агенти, розрізи по ринку / ціні / годинах / тижнях /
              днях, проковзування
            </span>
          </span>
        </button>
        {stats ? (
          <div className="grid gap-5 pb-3 md:grid-cols-2">
            <section>
              <div className="mb-1 text-sm font-semibold">Джерела угод</div>
              <SourcesList data={data} />
            </section>
            <section>
              <div className="mb-1 text-sm font-semibold">AI-агенти</div>
              <AgentsList data={data} />
            </section>
            {ORDER.map((key) => (
              <section key={key}>
                <div className="mb-1 text-sm font-semibold">
                  {BREAKDOWN_TITLES[key]}
                </div>
                <RowsList rows={data.breakdowns[key]} hidden={hidden} />
              </section>
            ))}
            <section>
              <div className="mb-1 text-sm font-semibold">{L.slippage}</div>
              <SlippageBlock data={data} />
            </section>
            <div className="md:col-span-2">
              <RowsLegend />
            </div>
          </div>
        ) : null}
      </Card>
    </>
  );
}
