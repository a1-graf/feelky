"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/ui";
import { muted, TradeRow } from "./poly-below-min/kit";
import type { BelowTrade } from "./poly-below-variants/data";

const FEW = 3;

/** Latest trades at the bottom of /poly: the first three of the (already sorted, at most ten) list, the rest on "Показати ще". */
export function PolyRecentTrades({ trades, hidden }: { trades: BelowTrade[]; hidden: boolean }) {
  const [open, setOpen] = useState(false);
  const visible = open ? trades : trades.slice(0, FEW);
  return (
    <Card data-recent-trades className="mt-4 px-5 pb-2 pt-4 sm:px-6 sm:pt-5">
      <h2 className="text-[15px] font-bold sm:text-xl">Останні угоди</h2>
      {visible.length ? (
        <div className="mt-1">
          {visible.map((trade) => (
            <TradeRow key={trade.id} trade={trade} hidden={hidden} withDate />
          ))}
        </div>
      ) : (
        <div className={cn("py-3 text-sm", muted)}>Угод немає</div>
      )}
      {trades.length > FEW ? (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className={cn("w-full border-t border-foreground/10 py-2.5 text-center text-sm", muted)}
        >
          {open ? "Згорнути" : `Показати ще · ${trades.length - FEW}`}
        </button>
      ) : null}
    </Card>
  );
}
