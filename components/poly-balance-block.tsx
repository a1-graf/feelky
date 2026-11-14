"use client";

import { useState } from "react";
import { FxBalanceChart, type ChartRange } from "@/components/fx-balance-chart";
import { BigTile } from "@/components/stat-tiles";
import { formatMoney } from "@/lib/money";
import type { FxBalancePoint } from "@/lib/fx-stats";

/**
 * Balance tile as on /fx; while hovered (or held on a phone) the balance-over-time chart replaces the figure.
 * The chart is laid over the tile itself, so it takes exactly the tile's box and the grid never jumps; its window comes from the card's period switcher.
 */
export function PolyBalanceBlock({ balance, series, currency, hidden, range }: { balance: string; series: FxBalancePoint[]; currency: string; hidden: boolean; range: ChartRange }) {
  const [open, setOpen] = useState(false);
  const touch = (pointerType: string) => pointerType !== "mouse";

  return (
    <div
      className="relative select-none [-webkit-touch-callout:none]"
      onPointerEnter={(event) => !touch(event.pointerType) && setOpen(true)}
      onPointerLeave={(event) => !touch(event.pointerType) && setOpen(false)}
      onPointerDown={(event) => touch(event.pointerType) && setOpen(true)}
      onPointerUp={(event) => touch(event.pointerType) && setOpen(false)}
      onPointerCancel={() => setOpen(false)}
      onContextMenu={(event) => event.preventDefault()}
    >
      <BigTile label="Баланс" className={open ? "invisible h-full" : "h-full"}>
        {formatMoney(balance, currency, hidden)}
      </BigTile>
      {open && <FxBalanceChart data={series} currency={currency} oneR={0} hidden={hidden} title="Баланс" showTotal={false} range={range} className="absolute inset-0 z-20 min-h-0" />}
    </div>
  );
}
