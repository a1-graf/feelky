"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/money";
import type { summarizeFx } from "@/lib/fx-stats";

type Trade = ReturnType<typeof summarizeFx>["trades"][number];

const PREVIEW = 5;

const tone = (value: string) => (Number(value) >= 0 ? "text-success" : "text-danger");
const signed = (value: string) => (Number(value) > 0 ? `+${value}` : value);
const formatR = (r: string | null, hidden: boolean) => (hidden ? "****" : r == null ? "—" : `${signed(r)}R`);
const formatDate = (iso: string) => new Date(iso).toLocaleString("uk-UA", { timeZone: "Europe/Kyiv", dateStyle: "short", timeStyle: "short" });

const muted = "text-[hsl(var(--card-muted-foreground))]";
const th = `px-2 py-2 text-xs font-normal ${muted}`;
const td = "px-2 py-2.5 whitespace-nowrap tabular-nums";
const toggle = "min-h-11 w-full rounded-lg border border-border bg-muted px-5 text-sm font-medium transition-colors hover:bg-muted/70 md:w-auto";
const badge = "rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium";
const risk = (trade: Trade, hidden: boolean) => (hidden ? "****" : trade.riskR == null ? "—" : `${trade.riskR}R`);

function PositionCard({ trade, currency, hidden }: { trade: Trade; currency: string; hidden: boolean }) {
  return (
    <li>
      <details className="group rounded-lg border border-border/60">
        <summary className="flex min-h-11 cursor-pointer items-start justify-between gap-3 px-3 py-2.5">
          <span className="sr-only">Деталі позиції</span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{trade.instrument}</span>
              <span className={badge}>{trade.side === "BUY" ? "BUY" : "SELL"}</span>
            </div>
            <div className={`mt-0.5 text-xs tabular-nums ${muted}`}>{formatDate(trade.closedAt)}</div>
          </div>
          <div className="flex shrink-0 items-start gap-1.5">
            <div className="whitespace-nowrap text-right tabular-nums">
              <div className={`font-semibold ${tone(trade.pnl)}`}>{formatMoney(trade.pnl, currency, hidden)}</div>
              <div className={`text-xs font-medium ${trade.r == null ? muted : tone(trade.r)}`}>{formatR(trade.r, hidden)}</div>
            </div>
            <ChevronDown aria-hidden className={`mt-1 h-4 w-4 transition-transform group-open:rotate-180 ${muted}`} />
          </div>
        </summary>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-border/60 px-3 py-3 text-sm tabular-nums">
          <div>
            <dt className={`text-[10px] ${muted}`}>Лот</dt>
            <dd className="font-medium">{trade.lots ?? "—"}</dd>
          </div>
          <div>
            <dt className={`text-[10px] ${muted}`}>Ризик, R</dt>
            <dd className="font-medium">{risk(trade, hidden)}</dd>
          </div>
          <div>
            <dt className={`text-[10px] ${muted}`}>Вхід</dt>
            <dd className="font-medium">{trade.openPrice ?? "—"}</dd>
          </div>
          <div>
            <dt className={`text-[10px] ${muted}`}>Вихід</dt>
            <dd className="font-medium">{trade.closePrice ?? "—"}</dd>
          </div>
        </dl>
      </details>
    </li>
  );
}

export function FxPositions({ trades, currency, hidden = false }: { trades: Trade[]; currency: string; hidden?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? trades : trades.slice(0, PREVIEW);
  const rest = trades.length - PREVIEW;

  return (
    <Card className="mt-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div className="font-semibold">Позиції</div>
        {trades.length ? <div className={`text-xs ${muted}`}>{expanded ? `усі ${trades.length}` : `${visible.length} з ${trades.length}`}</div> : null}
      </div>
      {trades.length ? (
        <>
          <ul className="grid gap-2 md:hidden" aria-label="Позиції">
            {visible.map((trade) => (
              <PositionCard key={trade.id} trade={trade} currency={currency} hidden={hidden} />
            ))}
          </ul>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[720px] text-sm">
              <caption className="sr-only">Закриті позиції</caption>
              <thead>
                <tr className="text-left">
                  <th scope="col" className={th}>Закрито</th>
                  <th scope="col" className={th}>Інструмент</th>
                  <th scope="col" className={th}>Сторона</th>
                  <th scope="col" className={`${th} text-right`}>Лот</th>
                  <th scope="col" className={`${th} text-right`}>Вхід → вихід</th>
                  <th scope="col" className={`${th} text-right`}>R</th>
                  <th scope="col" className={`${th} text-right`}>Ризик, R</th>
                  <th scope="col" className={`${th} text-right`}>$</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((trade) => (
                  <tr key={trade.id} className="border-t border-border/60" title={trade.note ?? undefined}>
                    <td className={`${td} ${muted}`}>{formatDate(trade.closedAt)}</td>
                    <td className={`${td} font-medium`}>{trade.instrument}</td>
                    <td className={td}>
                      <span className={badge}>{trade.side === "BUY" ? "BUY" : "SELL"}</span>
                    </td>
                    <td className={`${td} text-right`}>{trade.lots ?? "—"}</td>
                    <td className={`${td} text-right ${muted}`}>
                      {trade.openPrice && trade.closePrice ? `${trade.openPrice} → ${trade.closePrice}` : "—"}
                    </td>
                    <td className={`${td} text-right font-semibold ${trade.r == null ? "" : tone(trade.r)}`}>{formatR(trade.r, hidden)}</td>
                    <td className={`${td} text-right ${muted}`}>{risk(trade, hidden)}</td>
                    <td className={`${td} text-right font-semibold ${tone(trade.pnl)}`}>{formatMoney(trade.pnl, currency, hidden)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rest > 0 && (
            <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-10 mt-3 rounded-lg border border-border bg-card p-2 shadow-soft md:bottom-4 md:flex md:justify-center md:border-0 md:bg-transparent md:p-0 md:shadow-none">
              <button type="button" onClick={() => setExpanded((value) => !value)} className={toggle} aria-expanded={expanded}>
                {expanded ? "Згорнути" : `Показати ще (${rest})`}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className={`rounded-lg border border-dashed border-border p-5 text-center text-sm ${muted}`}>Поки немає угод.</div>
      )}
    </Card>
  );
}
