"use client";

import { useState } from "react";
import { FxBalanceChart, type ChartRange } from "@/components/fx-balance-chart";
import { BigTile } from "@/components/stat-tiles";
import { formatMoney } from "@/lib/money";
import type { FxBalancePoint } from "@/lib/fx-stats";

/**
 * Balance tile as on /fx; while hovered (or held on a phone) the figure fades out and the balance-over-time chart wipes in over it.
 * The chart stays mounted and is laid over the tile itself, so it takes exactly the tile's box and the grid never jumps; its window comes from the card's period switcher.
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
      <BigTile label="Баланс" className={`h-full transition-[opacity,filter,transform] duration-500 ease-out motion-reduce:transition-none ${open ? "scale-[0.97] opacity-0 blur-[2px]" : "opacity-100"}`}>
        {formatMoney(balance, currency, hidden)}
      </BigTile>
      <div
        aria-hidden={!open}
        className={`absolute inset-0 z-20 transition-[opacity,clip-path] duration-500 ease-out motion-reduce:transition-none ${open ? "opacity-100 [clip-path:inset(0_0_0_0)]" : "pointer-events-none opacity-0 [clip-path:inset(0_100%_0_0)]"}`}
      >
        <FxBalanceChart data={series} currency={currency} oneR={0} hidden={hidden} title="Баланс" showTotal={false} range={range} ticks className="absolute inset-0 min-h-0" />
      </div>
    </div>
  );
}
