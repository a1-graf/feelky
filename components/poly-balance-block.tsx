"use client";

import { useState } from "react";
import { RangeAreaChart, type RangePoint } from "@/components/range-area-chart";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/ui";

const muted = "text-[hsl(var(--card-muted-foreground))]";

/** Current pool balance; while hovered (or held on a phone) the figure turns into the balance-over-time chart. */
export function PolyBalanceBlock({ balance, series, currency, hidden, className }: { balance: string; series: RangePoint[]; currency: string; hidden: boolean; className?: string }) {
  const [open, setOpen] = useState(false);
  const touch = (pointerType: string) => pointerType !== "mouse";

  return (
    <Card
      className={cn("flex select-none flex-col [-webkit-touch-callout:none]", className)}
      onPointerEnter={(event) => !touch(event.pointerType) && setOpen(true)}
      onPointerLeave={(event) => !touch(event.pointerType) && setOpen(false)}
      onPointerDown={(event) => touch(event.pointerType) && setOpen(true)}
      onPointerUp={(event) => touch(event.pointerType) && setOpen(false)}
      onPointerCancel={() => setOpen(false)}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className={`text-[11px] font-medium sm:text-[13px] ${muted}`}>Баланс</div>
      {open ? (
        <div className="mt-1 grid flex-1">
          <RangeAreaChart data={series} currency={currency} hidden={hidden} totalLabel="Баланс" emptyLabel="Поки немає історії балансу" defaultPreset="all" showChange={false} />
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center pb-5 text-4xl font-bold tabular-nums">{formatMoney(balance, currency, hidden)}</div>
      )}
    </Card>
  );
}
