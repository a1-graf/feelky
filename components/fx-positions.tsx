"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { formatMoney, formatPlain, formatSigned } from "@/lib/money";
import type { summarizeFx } from "@/lib/fx-stats";

type Trade = ReturnType<typeof summarizeFx>["trades"][number];

const PREVIEW = 5;

const tone = (value: string) => (Number(value) >= 0 ? "text-success" : "text-danger");
const signed = (value: string) => formatSigned(value);
const formatR = (r: string | null, hidden: boolean) => (hidden ? "****" : r == null ? "—" : `${signed(r)}R`);
const formatDate = (iso: string) => new Date(iso).toLocaleString("uk-UA", { timeZone: "Europe/Kyiv", dateStyle: "short", timeStyle: "short" });

const th = "px-2 py-2 text-xs font-normal text-[hsl(var(--card-muted-foreground))]";
const td = "px-2 py-2.5 whitespace-nowrap";
const pill = "min-h-11 rounded-full border border-border bg-card px-5 text-sm font-medium shadow-soft transition-colors hover:bg-muted";

export function FxPositions({ trades, currency, hidden = false }: { trades: Trade[]; currency: string; hidden?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? trades : trades.slice(0, PREVIEW);
  const rest = trades.length - PREVIEW;

  return (
    <Card className="mt-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div className="font-semibold">Позиції</div>
        {trades.length ? <div className="text-xs text-[hsl(var(--card-muted-foreground))]">{expanded ? `усі ${trades.length}` : `${visible.length} з ${trades.length}`}</div> : null}
      </div>
      {trades.length ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="text-left">
                  <th className={th}>Закрито</th>
                  <th className={th}>Інструмент</th>
                  <th className={th}>Сторона</th>
                  <th className={`${th} text-right`}>Лот</th>
                  <th className={`${th} text-right`}>Вхід → вихід</th>
                  <th className={`${th} text-right`}>R</th>
                  <th className={`${th} text-right`}>Ризик, R</th>
                  <th className={`${th} text-right`}>$</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((trade) => (
                  <tr key={trade.id} className="border-t border-border/60" title={trade.note ?? undefined}>
                    <td className={`${td} text-[hsl(var(--card-muted-foreground))]`}>{formatDate(trade.closedAt)}</td>
                    <td className={`${td} font-medium`}>{trade.instrument}</td>
                    <td className={td}>
                      <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium">{trade.side === "BUY" ? "BUY" : "SELL"}</span>
                    </td>
                    <td className={`${td} text-right`}>{trade.lots == null ? "—" : formatPlain(trade.lots)}</td>
                    <td className={`${td} text-right text-[hsl(var(--card-muted-foreground))]`}>
                      {trade.openPrice && trade.closePrice ? `${formatPlain(trade.openPrice)} → ${formatPlain(trade.closePrice)}` : "—"}
                    </td>
                    <td className={`${td} text-right font-semibold ${trade.r == null ? "" : tone(trade.r)}`}>{formatR(trade.r, hidden)}</td>
                    <td className={`${td} text-right text-[hsl(var(--card-muted-foreground))]`}>{hidden ? "****" : trade.riskR == null ? "—" : `${formatPlain(trade.riskR)}R`}</td>
                    <td className={`${td} text-right font-semibold ${tone(trade.pnl)}`}>{formatMoney(trade.pnl, currency, hidden)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rest > 0 && (
            <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-10 mt-3 flex justify-center md:bottom-4">
              <button type="button" onClick={() => setExpanded((value) => !value)} className={pill} aria-expanded={expanded}>
                {expanded ? "Згорнути" : `Показати ще (${rest})`}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-[hsl(var(--card-muted-foreground))]">Поки немає угод.</div>
      )}
    </Card>
  );
}
