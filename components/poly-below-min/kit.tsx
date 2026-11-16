"use client";

import { useMemo, useState } from "react";
import { formatPlain } from "@/lib/money";
import { cn } from "@/lib/ui";
import type { BelowData, BelowRow, BelowTrade } from "../poly-below-variants/data";
import { kindLabel } from "../poly-below-variants/labels";
import type { BreakdownKey } from "../poly-below-variants/labels";
import {
  Chevron,
  kyivDate,
  money,
  muted,
  pct,
  pfText,
  signed,
  SOURCE_SHORT,
  tone,
  trades,
} from "../poly-below-variants/shared";

export { Chevron, money, muted, signed, tone, trades };

/** Hairline used instead of cards and fills in every minimal variant. */
export const HAIR = "border-foreground/10";
export const DIV = "divide-foreground/10";

// "По днях" is left out: the day calendar right above already shows every day.
export const CUTS: Array<{ key: BreakdownKey; label: string }> = [
  { key: "market", label: "Тип ринку" },
  { key: "price", label: "Ціна входу" },
  { key: "hour", label: "Години, UTC" },
  { key: "week", label: "Тижні" },
];

export const best = (rows: BelowRow[]) =>
  rows.reduce<BelowRow | null>((top, row) => (!top || Number(row.pnl) > Number(top.pnl) ? row : top), null);

/** Small muted heading over a group of rows. */
export function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("text-xs", muted, className)}>{children}</div>;
}

/** A label with a "?" that unfolds a one-line explanation instead of printing it under every figure. */
export function Hint({ label, text }: { label: string; text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="inline">
      {label}
      <button
        type="button"
        aria-label={`Що таке «${label}»`}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={cn("ml-1 inline-flex size-3.5 items-center justify-center rounded-full border text-[9px] leading-none", HAIR, muted)}
      >
        ?
      </button>
      {open ? <span className={cn("mt-0.5 block whitespace-normal text-[11px] font-normal", muted)}>{text}</span> : null}
    </span>
  );
}

export const PF_HINT = "Сума виграшів ÷ сума програшів; більше 1 — у плюсі.";

/** The pool as the one big figure, with only the part the page does not already show (the locked money). */
export function PoolHero({ data, bar = false, note = true }: { data: BelowData; bar?: boolean; note?: boolean }) {
  const { metrics: m, hidden } = data;
  const total = Number(m.poolTotal) || 1;
  const locked = Number(m.lockedPrincipal);
  return (
    <div>
      <Label>Пул</Label>
      <div className="mt-0.5 text-3xl font-semibold tabular-nums tracking-tight">{money(m.poolTotal, hidden)}</div>
      {bar && !hidden ? (
        <div className="mt-2 flex h-1 overflow-hidden rounded-full bg-foreground/10">
          <i className="block h-full bg-foreground/60" style={{ width: `${(locked / total) * 100}%` }} />
        </div>
      ) : null}
      {note && locked > 0 ? (
        <div className={cn("mt-1 text-xs", muted)}>{money(m.lockedPrincipal, hidden)} заблоковано в AI-агентах</div>
      ) : null}
    </div>
  );
}

/** Figures that are not in the top card: open exposure, profit factor, fees. */
export function minorStats(data: BelowData) {
  const { metrics: m, hidden } = data;
  const pf = m.profitFactor == null || hidden ? "" : Number(m.profitFactor) >= 1 ? "text-success" : "text-danger";
  return [
    { key: "open", label: <>У відкритих угодах</>, value: money(m.openExposure, hidden), cls: "" },
    { key: "pf", label: <Hint label="Профіт-фактор" text={PF_HINT} />, value: pfText(data), cls: pf },
    { key: "fees", label: <>Комісії</>, value: money(m.fees, hidden), cls: "" },
  ];
}

/** The three minor figures in one row: grey label above, value below, no boxes. */
export function Minor({ data, className }: { data: BelowData; className?: string }) {
  // Open exposure only matters while something is open.
  const items = minorStats(data).filter((item) => item.key !== "open" || data.metrics.openCount > 0);
  return (
    <div className={cn("grid gap-3", items.length === 3 ? "grid-cols-3" : "grid-cols-2", className)}>
      {items.map((item) => (
        <div key={item.key} className="min-w-0">
          <div className={cn("whitespace-nowrap text-[11px] leading-tight", muted)}>{item.label}</div>
          <div className={cn("mt-0.5 text-sm tabular-nums", item.cls)}>{item.value}</div>
        </div>
      ))}
    </div>
  );
}

/** Label on the left, figure on the right, nothing else: the basic line of every list. */
export function KV({
  label,
  value,
  valueClass,
  sub,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  valueClass?: string;
  sub?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("py-2.5 text-sm", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0">{label}</span>
        <span className={cn("shrink-0 tabular-nums", valueClass)}>{value}</span>
      </div>
      {sub ? <div className={cn("mt-0.5 text-xs", muted)}>{sub}</div> : null}
    </div>
  );
}

const rowSub = (row: BelowRow, hidden: boolean) => `${trades(row.count)} · вінрейт ${pct(row.winRate, hidden)}`;

/** Breakdown rows: name and result, count and win rate in grey underneath; hairlines between. */
export function Rows({ rows, hidden }: { rows: BelowRow[]; hidden: boolean }) {
  if (!rows.length) return <div className={cn("py-2 text-sm", muted)}>Поки порожньо</div>;
  return (
    <div className={cn("divide-y", DIV)}>
      {rows.map((row) => (
        <KV key={row.name} label={row.label} value={signed(row.pnl, hidden)} valueClass={hidden ? "" : tone(row.pnl)} sub={rowSub(row, hidden)} />
      ))}
    </div>
  );
}

/** One line per row: name with its trade count, a 2px bar around a zero line, the result. */
export function BarRows({ rows, hidden }: { rows: BelowRow[]; hidden: boolean }) {
  if (!rows.length) return <div className={cn("py-2 text-sm", muted)}>Поки порожньо</div>;
  const max = Math.max(...rows.map((row) => Math.abs(Number(row.pnl))), 0.01);
  return (
    <div className="grid gap-1.5">
      {rows.map((row) => {
        const value = Number(row.pnl);
        return (
          <div key={row.name} className="grid grid-cols-[8rem_1fr_5.5rem] items-center gap-2 text-sm">
            <span className="truncate">
              {row.label}
              <span className={cn("ml-1.5 text-xs", muted)}>{row.count}</span>
            </span>
            <span className="relative h-0.5 bg-foreground/[0.07]">
              {hidden ? null : (
                <>
                  <i className="absolute -inset-y-1 left-1/2 w-px bg-foreground/20" />
                  <i
                    className={cn("absolute inset-y-0", value >= 0 ? "left-1/2 bg-success" : "right-1/2 bg-danger")}
                    style={{ width: `${(Math.abs(value) / max) * 50}%` }}
                  />
                </>
              )}
            </span>
            <span className={cn("text-right tabular-nums", !hidden && tone(value))}>{signed(value, hidden)}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Sources with the AI agents folded into the "AI-агенти" line, so agents are not listed twice. */
export function Sources({ data }: { data: BelowData }) {
  const { hidden } = data;
  return (
    <div className={cn("divide-y", DIV)}>
      {data.sources.map((source) => (
        <KV
          key={source.key}
          label={source.label}
          value={signed(source.all.pnl, hidden)}
          valueClass={hidden ? "" : tone(source.all.pnl)}
          sub={source.key === "AI_AGENT" ? <AgentLine data={data} /> : rowSub(source.all, hidden)}
        />
      ))}
    </div>
  );
}

/** One grey line per agent: name, (locked sum,) when it unlocks; green only when it can be taken out. */
export function AgentLine({ data, amount = false }: { data: BelowData; amount?: boolean }) {
  const { hidden } = data;
  if (!data.agents.length) return <>ще не підключено</>;
  return (
    <>
      {data.agents.map((agent) => (
        <span key={agent.name} className="block">
          {agent.name}
          {agent.lock ? (
            <>
              {" · "}
              {amount ? `${money(agent.lock.amount, hidden)} заблоковано · ` : ""}
              {agent.lock.canRelease ? (
                <span className="text-success">можна виймати</span>
              ) : (
                `до ${kyivDate(agent.lock.unlockAt)}`
              )}
            </>
          ) : (
            ` · ${trades(agent.count)}`
          )}
        </span>
      ))}
    </>
  );
}

/** "можна виймати" in green, or the unlock date, for the first locked agent. */
export function LockStatus({ data }: { data: BelowData }) {
  const lock = data.agents.find((agent) => agent.lock)?.lock;
  if (!lock) return null;
  return lock.canRelease ? <span className="text-success">можна виймати</span> : <>до {kyivDate(lock.unlockAt)}</>;
}

export function slippageLine(data: BelowData) {
  const { slippage, hidden } = data;
  if (!slippage.count) return null;
  return {
    value: money(`-${slippage.costUsd}`, hidden),
    sub: hidden ? "" : `${slippage.worseCount} з ${trades(slippage.count)} гірше за ціну сигналу`,
  };
}

export function Slippage({ data, className }: { data: BelowData; className?: string }) {
  const line = slippageLine(data);
  if (!line) return null;
  return <KV className={className} label="Проковзування копітрейду" value={line.value} valueClass={data.hidden ? "" : "text-danger"} sub={line.sub} />;
}

/** Text tabs underlined by a 2px rule; no pill backgrounds. */
export function TextTabs<T extends string>({
  items,
  value,
  onChange,
  className,
  small = false,
}: {
  items: Array<{ key: T; label: React.ReactNode }>;
  value: T;
  onChange: (key: T) => void;
  className?: string;
  small?: boolean;
}) {
  return (
    <div role="tablist" className={cn("flex gap-5 overflow-x-auto border-b", HAIR, small ? "text-xs" : "text-sm", className)}>
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          role="tab"
          aria-selected={value === item.key}
          onClick={() => onChange(item.key)}
          className={cn(
            "-mb-px shrink-0 whitespace-nowrap border-b-2 pb-2 transition-colors",
            value === item.key ? "border-foreground font-medium" : cn("border-transparent", muted),
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Europe/Kyiv" });
const dayTitle = (key: string) =>
  new Date(`${key}T12:00:00Z`).toLocaleDateString("uk-UA", { weekday: "long", day: "numeric", month: "long" });
const time = (iso: string) => new Date(iso).toLocaleTimeString("uk-UA", { timeZone: "Europe/Kyiv", hour: "2-digit", minute: "2-digit" });
const stamp = (iso: string) =>
  new Date(iso).toLocaleString("uk-UA", { timeZone: "Europe/Kyiv", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

type Status = "" | "WON" | "LOST" | "OPEN";

/**
 * Trade list stripped to the essentials: three text filters, one line of market + side with the result,
 * a grey line with time, source, entry price and size. Optional day headings as plain text over a hairline.
 */
export function Trades({ data, pageSize = 10, byDay = false }: { data: BelowData; pageSize?: number; byDay?: boolean }) {
  const { hidden } = data;
  const [status, setStatus] = useState<Status>("");
  const [shown, setShown] = useState(pageSize);
  const count = (key: Status) => data.trades.filter((trade) => trade.status === key).length;
  const list = useMemo(
    () =>
      data.trades
        .filter((trade) => !status || trade.status === status)
        .sort((a, b) => Number(b.status === "OPEN") - Number(a.status === "OPEN") || b.openedAt.localeCompare(a.openedAt)),
    [data.trades, status],
  );
  const visible = list.slice(0, shown);
  const totals = useMemo(() => {
    const map = new Map<string, number>();
    for (const trade of list) map.set(dayKey(trade.openedAt), (map.get(dayKey(trade.openedAt)) ?? 0) + Number(trade.pnlUsd));
    return map;
  }, [list]);
  const tabs: Array<{ key: Status; label: React.ReactNode }> = [
    { key: "", label: <>Усі <span className={muted}>{data.trades.length}</span></> },
    ...(["WON", "LOST", "OPEN"] as const)
      .filter((key) => count(key) > 0)
      .map((key) => ({
        key,
        label: (
          <>
            {{ WON: "Виграші", LOST: "Програші", OPEN: "Відкриті" }[key]} <span className={muted}>{count(key)}</span>
          </>
        ),
      })),
  ];

  let lastDay = "";
  return (
    <div>
      <TextTabs
        items={tabs}
        value={status}
        onChange={(key) => {
          setStatus(key);
          setShown(pageSize);
        }}
      />
      {visible.length ? (
        <div>
          {visible.map((trade) => {
            const day = dayKey(trade.openedAt);
            const heading = byDay && day !== lastDay;
            lastDay = day;
            return (
              <div key={trade.id}>
                {heading ? (
                  <div className={cn("flex items-baseline justify-between border-b pb-1.5 pt-4 text-xs", HAIR)}>
                    <span className="font-medium first-letter:uppercase">{dayTitle(day)}</span>
                    <span className={cn("tabular-nums", !hidden && tone(totals.get(day) ?? 0))}>{signed(totals.get(day) ?? 0, hidden)}</span>
                  </div>
                ) : null}
                <TradeRow trade={trade} hidden={hidden} withDate={!byDay} />
              </div>
            );
          })}
        </div>
      ) : (
        <div className={cn("py-3 text-sm", muted)}>Угод немає</div>
      )}
      {list.length > shown ? (
        <button type="button" className={cn("mt-2 w-full py-2 text-center text-sm", muted)} onClick={() => setShown(shown + pageSize)}>
          Показати ще · {shown} з {list.length}
        </button>
      ) : null}
    </div>
  );
}

export function TradeRow({ trade, hidden, withDate }: { trade: BelowTrade; hidden: boolean; withDate: boolean }) {
  const open = trade.status === "OPEN";
  return (
    <div className={cn("border-b py-2 text-sm last:border-b-0", HAIR)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate">
          {kindLabel(trade.marketKind)} · {trade.outcome}
        </span>
        <span className={cn("shrink-0 tabular-nums", !open && !hidden && tone(trade.pnlUsd))}>{open ? "відкрита" : signed(trade.pnlUsd, hidden)}</span>
      </div>
      <div className={cn("mt-0.5 truncate text-xs", muted)}>
        {[
          withDate ? stamp(trade.openedAt) : time(trade.openedAt),
          trade.agentName ?? SOURCE_SHORT[trade.section],
          `вхід ${formatPlain(trade.entryPrice)}`,
          money(trade.sizeUsd, hidden),
        ].join(" · ")}
      </div>
    </div>
  );
}
