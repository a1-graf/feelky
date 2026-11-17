"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/ui";
import type { BelowData } from "./data";
import { BREAKDOWN_TITLES } from "./labels";
import type { BreakdownKey } from "./labels";
import {
  AgentsList,
  Disclosure,
  headline,
  L,
  muted,
  ReconcileAlert,
  RowsLegend,
  RowsList,
  signed,
  SlippageBlock,
  SourcesList,
  Stat,
  tone,
  TradeFeed,
  trades,
} from "./shared";

const ORDER: BreakdownKey[] = ["market", "price", "hour", "week", "day"];

/** Variant 1 — accordions: headline figures always visible, every other block folds into one line with its key number. */
export function BelowV1({ data }: { data: BelowData }) {
  const { hidden, metrics } = data;
  const lock = data.agents.find((agent) => agent.lock)?.lock;
  const best = (key: BreakdownKey) =>
    data.breakdowns[key].reduce<
      (typeof data.breakdowns)[BreakdownKey][number] | null
    >(
      (top, row) => (!top || Number(row.pnl) > Number(top.pnl) ? row : top),
      null,
    );

  return (
    <Card className="mt-4">
      <ReconcileAlert data={data} className="mb-3" />
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

      <div className="mt-2 divide-y divide-foreground/10">
        <Disclosure
          defaultOpen
          title="Джерела угод"
          summary={
            <span className={hidden ? "" : tone(metrics.totalPnl)}>
              {signed(metrics.totalPnl, hidden)}
            </span>
          }
        >
          <SourcesList data={data} />
          <RowsLegend />
        </Disclosure>

        <Disclosure
          title="AI-агенти"
          summary={
            lock ? (
              <span className={lock.canRelease ? "text-success" : muted}>
                {lock.canRelease ? "можна виймати" : `ще ${lock.daysLeft} дн.`}
              </span>
            ) : (
              <span className={muted}>без блокувань</span>
            )
          }
        >
          <AgentsList data={data} />
        </Disclosure>

        {ORDER.map((key) => {
          const top = best(key);
          return (
            <Disclosure
              key={key}
              title={BREAKDOWN_TITLES[key]}
              summary={
                top ? (
                  <span className={muted}>
                    найкраще:{" "}
                    <span className="text-foreground">{top.label}</span>
                  </span>
                ) : (
                  <span className={muted}>порожньо</span>
                )
              }
            >
              <RowsList rows={data.breakdowns[key]} hidden={hidden} />
              <RowsLegend />
            </Disclosure>
          );
        })}

        <Disclosure
          title={L.slippage}
          summary={
            <span className={cn(data.slippage.count ? "" : muted)}>
              {data.slippage.count
                ? trades(data.slippage.count)
                : "немає даних"}
            </span>
          }
        >
          <SlippageBlock data={data} />
        </Disclosure>

        <Disclosure
          title="Усі угоди"
          summary={<span className={muted}>{trades(data.trades.length)}</span>}
        >
          <TradeFeed data={data} pageSize={25} />
        </Disclosure>
      </div>
    </Card>
  );
}
