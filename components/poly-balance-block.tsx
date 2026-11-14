"use client";

import { useRef, useState } from "react";
import { FxBalanceChart } from "@/components/fx-balance-chart";
import { BigTile } from "@/components/stat-tiles";
import { formatMoney } from "@/lib/money";
import type { FxBalancePoint } from "@/lib/fx-stats";

/**
 * Balance tile as on /fx; while hovered (or held on a phone) the balance-over-time chart opens on top of it.
 * The tile sits at the top of the left column, so the chart covers that whole column (tile and the PnL chart under it):
 * the grid does not jump and the two charts never show through each other.
 */
export function PolyBalanceBlock({ balance, series, currency, hidden }: { balance: string; series: FxBalancePoint[]; currency: string; hidden: boolean }) {
  const [height, setHeight] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const open = height != null;
  const setOpen = (value: boolean) => setHeight(value ? (ref.current?.parentElement?.getBoundingClientRect().height ?? null) : null);
  const touch = (pointerType: string) => pointerType !== "mouse";

  return (
    <div
      ref={ref}
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
      {open && (
        <FxBalanceChart
          data={series}
          currency={currency}
          oneR={0}
          hidden={hidden}
          title="Баланс"
          showTotal={false}
          className="absolute inset-x-0 top-0 z-20 shadow-lg ring-1 ring-border"
          style={{ height }}
        />
      )}
    </div>
  );
}
