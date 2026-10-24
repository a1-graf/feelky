"use client";

import { useMemo, useState } from "react";
import { formatMoney, formatPlain } from "@/lib/money";

export type PolyTradeRow = {
  id: string;
  externalId: string;
  section: "MANUAL" | "COPYTRADE" | "AI_AGENT";
  agentName: string | null;
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
  signalPrice: string | null;
  note?: string | null;
};

const SECTION_LABELS = { MANUAL: "Вручну", COPYTRADE: "Копітрейд", AI_AGENT: "AI-агент" } as const;
const STATUS_LABELS = { OPEN: "Відкрита", WON: "Виграш", LOST: "Програш", VOID: "Скасована" } as const;
const PAGE_SIZE = 25;

type SortKey = "openedAt" | "pnlUsd" | "sizeUsd" | "entryPrice";

const liveNote = (note?: string | null) => note?.split("wallet-sync:")[1]?.trim() ?? null;
const tone = (value: string) => (Number(value) > 0 ? "text-success" : Number(value) < 0 ? "text-danger" : "");
const selectClass = "h-9 rounded-lg border border-border bg-background px-2 text-sm";

export function PolyTradesTable({ trades, hidden }: { trades: PolyTradeRow[]; hidden: boolean }) {
  const [section, setSection] = useState("");
  const [agent, setAgent] = useState("");
  const [status, setStatus] = useState("");
  const [kind, setKind] = useState("");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("openedAt");
  const [descending, setDescending] = useState(true);
  const [page, setPage] = useState(0);

  const agents = useMemo(() => Array.from(new Set(trades.map((trade) => trade.agentName).filter((name): name is string => Boolean(name)))).sort(), [trades]);
  const kinds = useMemo(() => Array.from(new Set(trades.map((trade) => trade.marketKind))).sort(), [trades]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = trades.filter(
      (trade) =>
        (!section || trade.section === section) &&
        (!agent || trade.agentName === agent) &&
        (!status || trade.status === status) &&
        (!kind || trade.marketKind === kind) &&
        (!needle || trade.title.toLowerCase().includes(needle) || trade.externalId.toLowerCase().includes(needle))
    );
    const value = (trade: PolyTradeRow) => (sortKey === "openedAt" ? new Date(trade.openedAt).getTime() : Number(trade[sortKey]));
    rows.sort((a, b) => Number(b.status === "OPEN") - Number(a.status === "OPEN") || (descending ? value(b) - value(a) : value(a) - value(b)));
    return rows;
  }, [trades, section, agent, status, kind, query, sortKey, descending]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const visible = filtered.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);
  const filteredPnl = filtered.reduce((sum, trade) => sum + Number(trade.pnlUsd), 0);

  const reset = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setPage(0);
  };
  const header = (key: SortKey, label: string) => (
    <button
      type="button"
      className="font-semibold hover:underline"
      onClick={() => {
        if (sortKey === key) setDescending(!descending);
        else {
          setSortKey(key);
          setDescending(true);
        }
        setPage(0);
      }}
    >
      {label}
      {sortKey === key ? (descending ? " ↓" : " ↑") : ""}
    </button>
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select className={selectClass} value={section} onChange={(event) => reset(setSection)(event.target.value)} aria-label="Розділ">
          <option value="">Усі розділи</option>
          {Object.entries(SECTION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select className={selectClass} value={agent} onChange={(event) => reset(setAgent)(event.target.value)} aria-label="Агент">
          <option value="">Усі агенти</option>
          {agents.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        <select className={selectClass} value={status} onChange={(event) => reset(setStatus)(event.target.value)} aria-label="Статус">
          <option value="">Усі статуси</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select className={selectClass} value={kind} onChange={(event) => reset(setKind)(event.target.value)} aria-label="Тип ринку">
          <option value="">Усі ринки</option>
          {kinds.map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
        <input
          className={`${selectClass} min-w-[10rem] flex-1`}
          placeholder="Пошук за ринком або id"
          value={query}
          onChange={(event) => reset(setQuery)(event.target.value)}
        />
      </div>

      <div className="mb-2 text-xs text-[hsl(var(--card-muted-foreground))]">
        {filtered.length} угод · PnL вибірки <span className={tone(String(filteredPnl))}>{formatMoney(filteredPnl, "USDT", hidden)}</span>
      </div>

      {visible.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs text-[hsl(var(--card-muted-foreground))]">
              <tr>
                <th className="py-2 pr-3">{header("openedAt", "Відкрито")}</th>
                <th className="py-2 pr-3">Розділ</th>
                <th className="py-2 pr-3">Ринок</th>
                <th className="py-2 pr-3 text-right">{header("entryPrice", "Ціна")}</th>
                <th className="py-2 pr-3 text-right">{header("sizeUsd", "Розмір")}</th>
                <th className="py-2 pr-3">Статус</th>
                <th className="py-2 text-right">{header("pnlUsd", "PnL")}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((trade) => (
                <tr key={trade.id} className="border-t border-border">
                  <td className="whitespace-nowrap py-2 pr-3 text-xs">
                    {new Date(trade.openedAt).toLocaleString("uk-UA", { timeZone: "Europe/Kyiv", dateStyle: "short", timeStyle: "short" })}
                  </td>
                  <td className="py-2 pr-3 text-xs">
                    {SECTION_LABELS[trade.section]}
                    {trade.agentName ? <div className="text-[hsl(var(--card-muted-foreground))]">{trade.agentName}</div> : null}
                  </td>
                  <td className="max-w-[18rem] py-2 pr-3">
                    <div className="truncate font-medium">{trade.title}</div>
                    <div className="text-xs text-[hsl(var(--card-muted-foreground))]">
                      {trade.marketKind} · {trade.outcome}
                      {trade.signalPrice ? ` · сигнал ${formatPlain(trade.signalPrice)}` : ""}
                    </div>
                  </td>
                  <td className="py-2 pr-3 text-right">{formatPlain(trade.entryPrice)}</td>
                  <td className="py-2 pr-3 text-right">{formatMoney(trade.sizeUsd, "USDT", hidden)}</td>
                  <td className="py-2 pr-3 text-xs">
                    {STATUS_LABELS[trade.status]}
                    {trade.status === "OPEN" && liveNote(trade.note) ? <div className="max-w-[14rem] text-[hsl(var(--card-muted-foreground))]">{liveNote(trade.note)}</div> : null}
                  </td>
                  <td className={`py-2 text-right font-semibold ${tone(trade.pnlUsd)}`}>{trade.status === "OPEN" ? "—" : formatMoney(trade.pnlUsd, "USDT", hidden)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-[hsl(var(--card-muted-foreground))]">
          Угод за цими фільтрами немає. Їх заносить OpenClaw.
        </div>
      )}

      {pages > 1 ? (
        <div className="mt-3 flex items-center justify-between text-sm">
          <button type="button" className="rounded-lg bg-muted px-3 py-1.5 disabled:opacity-40" disabled={current === 0} onClick={() => setPage(current - 1)}>
            Назад
          </button>
          <span className="text-xs text-[hsl(var(--card-muted-foreground))]">
            {current + 1} / {pages}
          </span>
          <button type="button" className="rounded-lg bg-muted px-3 py-1.5 disabled:opacity-40" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
            Далі
          </button>
        </div>
      ) : null}
    </div>
  );
}
