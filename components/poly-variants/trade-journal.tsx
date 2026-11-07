"use client";

import { useMemo, useState } from "react";
import { formatMoney, formatPlain, formatSigned } from "@/lib/money";
import { CUR, muted, plural, tone } from "@/components/poly-variants/ui";

export type JournalTrade = {
  id: string;
  source: string;
  walletRef: string | null;
  marketKind: string;
  title: string;
  outcome: string;
  entryPrice: string;
  sizeUsd: string;
  feesUsd: string;
  status: "OPEN" | "WON" | "LOST" | "VOID";
  pnlUsd: string;
  openedAt: string;
  resolvedAt: string | null;
  note: string | null;
};

const RESULTS = [
  { key: "", label: "Усі" },
  { key: "WON", label: "Виграші" },
  { key: "LOST", label: "Програші" },
  { key: "OPEN", label: "Відкриті" }
] as const;
const STATUS_LABELS = { OPEN: "відкрита", WON: "виграш", LOST: "програш", VOID: "скасована" } as const;
export const MARKET_KIND_LABELS: Record<string, string> = {
  BTC_5M: "BTC 5 хвилин",
  BTC_15M: "BTC 15 хвилин",
  ETH_5M: "ETH 5 хвилин",
  ETH_15M: "ETH 15 хвилин",
  OTHER: "Інші ринки"
};
const selectClass = "h-9 rounded-lg border border-border bg-background px-2 text-sm";
const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Europe/Kyiv" });
const dayTitle = (key: string) => new Date(`${key}T12:00:00Z`).toLocaleDateString("uk-UA", { weekday: "long", day: "numeric", month: "long" });
const time = (iso: string) => new Date(iso).toLocaleTimeString("uk-UA", { timeZone: "Europe/Kyiv", hour: "2-digit", minute: "2-digit" });

function Side({ title, trades, hidden, className }: { title: string; trades: JournalTrade[]; hidden: boolean; className: string }) {
  const sum = trades.reduce((total, trade) => total + Number(trade.pnlUsd), 0);
  const stake = trades.reduce((total, trade) => total + Number(trade.sizeUsd), 0);
  const price = trades.reduce((total, trade) => total + Number(trade.entryPrice), 0);
  const count = trades.length;
  const row = (label: string, value: string) => (
    <div className="flex justify-between gap-2">
      <span className={muted}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
  return (
    <div className="rounded-lg bg-muted p-3 text-sm">
      <div className="flex items-baseline justify-between">
        <span className="font-semibold">{title}</span>
        <span className={`text-lg font-semibold tabular-nums ${className}`}>{hidden ? "••••" : `${formatSigned(sum)} ${CUR}`}</span>
      </div>
      <div className="mt-2 grid gap-1 text-xs">
        {row("Угод", String(count))}
        {row("Середній результат угоди", count ? formatMoney(sum / count, CUR, hidden) : "—")}
        {row("Середня ставка", count ? formatMoney(stake / count, CUR, hidden) : "—")}
        {row("Середня ціна входу", count ? formatPlain(price / count) : "—")}
      </div>
    </div>
  );
}

/** Variant 3: a trade journal — filters on top, wins against losses, then every trade grouped by day. */
export function TradeJournal({ trades, hidden }: { trades: JournalTrade[]; hidden: boolean }) {
  const [result, setResult] = useState("");
  const [source, setSource] = useState("");
  const [wallet, setWallet] = useState("");
  const [kind, setKind] = useState("");

  const options = useMemo(
    () => ({
      sources: Array.from(new Set(trades.map((trade) => trade.source))).sort(),
      wallets: Array.from(new Set(trades.map((trade) => trade.walletRef ?? "без гаманця"))).sort(),
      kinds: Array.from(new Set(trades.map((trade) => trade.marketKind))).sort()
    }),
    [trades]
  );

  const base = useMemo(
    () => trades.filter((trade) => (!source || trade.source === source) && (!wallet || (trade.walletRef ?? "без гаманця") === wallet) && (!kind || trade.marketKind === kind)),
    [trades, source, wallet, kind]
  );
  const shown = useMemo(() => base.filter((trade) => !result || trade.status === result), [base, result]);
  const days = useMemo(() => {
    const map = new Map<string, JournalTrade[]>();
    for (const trade of shown) {
      const key = dayKey(trade.resolvedAt ?? trade.openedAt);
      map.set(key, [...(map.get(key) ?? []), trade]);
    }
    return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [shown]);

  const won = base.filter((trade) => trade.status === "WON");
  const lost = base.filter((trade) => trade.status === "LOST");
  const total = shown.reduce((sum, trade) => sum + Number(trade.pnlUsd), 0);

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1">
        {RESULTS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setResult(item.key)}
            className={`rounded-full px-3 py-1.5 text-sm ${result === item.key ? "bg-primary text-primary-foreground" : "bg-muted"}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <select className={selectClass} value={source} onChange={(event) => setSource(event.target.value)} aria-label="Джерело">
          <option value="">Усі джерела</option>
          {options.sources.map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
        <select className={selectClass} value={wallet} onChange={(event) => setWallet(event.target.value)} aria-label="Гаманець">
          <option value="">Усі гаманці</option>
          {options.wallets.map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
        <select className={selectClass} value={kind} onChange={(event) => setKind(event.target.value)} aria-label="Ринок">
          <option value="">Усі ринки</option>
          {options.kinds.map((value) => (
            <option key={value} value={value}>{MARKET_KIND_LABELS[value] ?? value}</option>
          ))}
        </select>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Side title="Виграші" trades={won} hidden={hidden} className="text-success" />
        <Side title="Програші" trades={lost} hidden={hidden} className="text-danger" />
      </div>

      <div className={`mb-2 text-xs ${muted}`}>
        {shown.length} {plural(shown.length, "угода", "угоди", "угод")} у вибірці · разом <span className={tone(total)}>{hidden ? "••••" : `${formatSigned(total)} ${CUR}`}</span>
      </div>

      {days.length ? (
        <div className="grid grid-cols-1 gap-4">
          {days.map(([key, rows]) => {
            const dayPnl = rows.reduce((sum, trade) => sum + Number(trade.pnlUsd), 0);
            return (
              <section key={key} className="min-w-0">
                <div className="mb-1 flex items-baseline justify-between border-b border-border pb-1 text-sm">
                  <span className="font-semibold first-letter:uppercase">{dayTitle(key)}</span>
                  <span className={`tabular-nums ${tone(dayPnl)}`}>{hidden ? "••••" : `${formatSigned(dayPnl)} ${CUR}`}</span>
                </div>
                <ul>
                  {rows.map((trade) => (
                    <li key={trade.id} className="border-b border-border/50 last:border-0">
                      <details className="group min-w-0 py-2">
                        <summary className="flex cursor-pointer list-none items-center gap-3 text-sm">
                          <span className={`h-2 w-2 shrink-0 rounded-full ${trade.status === "WON" ? "bg-success" : trade.status === "LOST" ? "bg-danger" : "bg-muted-foreground"}`} />
                          <span className={`w-12 shrink-0 text-xs tabular-nums ${muted}`}>{time(trade.resolvedAt ?? trade.openedAt)}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate">{trade.title}</span>
                            <span className={`block text-xs ${muted}`}>
                              {trade.outcome} за {formatPlain(trade.entryPrice)} · ставка {formatMoney(trade.sizeUsd, CUR, hidden)} · {trade.source}
                            </span>
                          </span>
                          <span className={`shrink-0 font-semibold tabular-nums ${tone(trade.pnlUsd)}`}>
                            {trade.status === "OPEN" ? "відкрита" : hidden ? "••••" : formatSigned(trade.pnlUsd)}
                          </span>
                        </summary>
                        <div className={`mt-2 grid gap-1 rounded-lg bg-muted p-3 text-xs ${muted}`}>
                          <div>Статус: {STATUS_LABELS[trade.status]} · ринок: {MARKET_KIND_LABELS[trade.marketKind] ?? trade.marketKind}</div>
                          <div>Гаманець: {trade.walletRef ?? "не вказано"} · комісія {formatMoney(trade.feesUsd, CUR, hidden)}</div>
                          <div>
                            Відкрито {new Date(trade.openedAt).toLocaleString("uk-UA", { timeZone: "Europe/Kyiv" })}
                            {trade.resolvedAt ? ` · закрито ${new Date(trade.resolvedAt).toLocaleString("uk-UA", { timeZone: "Europe/Kyiv" })}` : ""}
                          </div>
                          {trade.note ? <div className="break-words">Примітка: {trade.note}</div> : null}
                        </div>
                      </details>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      ) : (
        <div className={`rounded-lg border border-dashed border-border p-5 text-center text-sm ${muted}`}>За цими фільтрами угод немає</div>
      )}
    </div>
  );
}
