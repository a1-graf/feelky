"use client";

import { useMemo, useState } from "react";
import {
  formatMoney,
  formatPercent,
  formatPlain,
  formatSigned,
} from "@/lib/money";
import { cn } from "@/lib/ui";
import type { BelowData, BelowRow, BelowTrade } from "./data";
import { kindLabel } from "./labels";

export const CUR = "USD";
export const muted = "text-[hsl(var(--card-muted-foreground))]";
export const tone = (value: string | number) =>
  Number(value) > 0.004
    ? "text-success"
    : Number(value) < -0.004
      ? "text-danger"
      : "";

export const L = {
  pnl: "Прибуток / збиток (PnL)",
  winRate: "Вінрейт (частка виграшних)",
  roi: "Рентабельність (ROI)",
  pf: "Профіт-фактор (прибутки ÷ збитки)",
  fees: "Комісії",
  open: "У відкритих угодах",
  openCount: "Відкритих угод",
  pool: "Пул зараз",
  slippage: "Проковзування копітрейду",
} as const;

export const SOURCE_SHORT = {
  MANUAL: "Вручну",
  COPYTRADE: "Копітрейд",
  AI_AGENT: "AI-агент",
} as const;
export const STATUS_LABELS = {
  OPEN: "Відкрита",
  WON: "Виграш",
  LOST: "Програш",
  VOID: "Скасована",
} as const;

export const money = (value: string | number, hidden: boolean) =>
  formatMoney(value, CUR, hidden);
export const signed = (value: string | number, hidden: boolean) =>
  hidden ? "••••" : `${formatSigned(value)} ${CUR}`;
export const pct = (value: string | number, hidden: boolean) =>
  formatPercent(value, hidden);
export const signedPct = (value: string | number, hidden: boolean) =>
  hidden ? "••••" : `${formatSigned(value)}%`;
export const pfText = (data: BelowData) =>
  data.hidden
    ? "••••"
    : data.metrics.profitFactor == null
      ? "—"
      : formatPlain(data.metrics.profitFactor);

export function plural(count: number, one: string, few: string, many: string) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
export const trades = (count: number) =>
  `${count} ${plural(count, "угода", "угоди", "угод")}`;

// "Bitcoin Up or Down - October 22, 7:40PM-7:45PM ET": the market type is already in the second line, the window is what matters.
const shortTitle = (title: string) =>
  title.replace(/^(Bitcoin|Ethereum|BTC|ETH) Up or Down\s*[-–]\s*/i, "") ||
  title;

export const kyivDate = (iso: string) =>
  new Date(iso).toLocaleDateString("uk-UA", { timeZone: "Europe/Kyiv" });
export const kyivStamp = (iso: string) =>
  new Date(iso).toLocaleString("uk-UA", {
    timeZone: "Europe/Kyiv",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

export function Chevron({
  open,
  className,
}: {
  open: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden
      className={cn(
        "size-4 shrink-0 transition-transform",
        open && "rotate-90",
        muted,
        className,
      )}
    >
      <path
        d="M6 3.5 10.5 8 6 12.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Red banner for a pool that no longer matches its ledger: it must stay visible in every variant. */
export function ReconcileAlert({
  data,
  className,
}: {
  data: BelowData;
  className?: string;
}) {
  const { reconcile, hidden } = data;
  if (!reconcile || reconcile.ok) return null;
  return (
    <div
      role="alert"
      className={cn(
        "flex gap-3 rounded-xl border border-danger/50 bg-danger/10 p-3 text-sm text-danger",
        className,
      )}
    >
      <span aria-hidden className="text-lg leading-5">
        ⚠
      </span>
      <div>
        <div className="font-semibold">Звірка балансу не сходиться</div>
        <div className="mt-0.5">
          Баланс пулу відрізняється від леджера (журналу проводок) на{" "}
          <b>{money(reconcile.balanceDrift, hidden)}</b>, проведений прибуток /
          збиток угод — на <b>{money(reconcile.pnlDrift, hidden)}</b>. Перевір
          ручні правки балансу або видалені рядки.
        </div>
      </div>
    </div>
  );
}

/** Small "label over value" cell used by dense grids. */
export function Stat({
  label,
  value,
  hint,
  className,
  valueClass,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
  valueClass?: string;
}) {
  return (
    <div className={cn("min-w-0 rounded-lg bg-muted px-3 py-2", className)}>
      <div className={`text-[11px] leading-tight sm:text-xs ${muted}`}>
        {label}
      </div>
      <div className={cn("mt-0.5 font-semibold tabular-nums", valueClass)}>
        {value}
      </div>
      {hint ? (
        <div className={`mt-0.5 text-[11px] leading-tight ${muted}`}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}

/** The five headline figures the old lower card showed, plus the pool split, as a list for any layout. */
export function headline(data: BelowData) {
  const { metrics: m, hidden } = data;
  return [
    {
      key: "pool",
      label: L.pool,
      value: money(m.poolTotal, hidden),
      hint: hidden
        ? null
        : `вільно ${formatPlain(m.poolBalance)} · заблоковано ${formatPlain(m.lockedPrincipal)}`,
    },
    {
      key: "exposure",
      label: L.open,
      value: money(m.openExposure, hidden),
      hint: `${L.openCount.toLowerCase()}: ${m.openCount}`,
    },
    {
      key: "pf",
      label: L.pf,
      value: pfText(data),
      valueClass:
        data.metrics.profitFactor != null && !hidden
          ? Number(data.metrics.profitFactor) >= 1
            ? "text-success"
            : "text-danger"
          : "",
      hint: "більше 1 — у плюсі",
    },
    { key: "fees", label: L.fees, value: money(m.fees, hidden), hint: null },
  ];
}

export function Disclosure({
  title,
  summary,
  defaultOpen = false,
  children,
  className,
}: {
  title: React.ReactNode;
  summary?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 py-3 text-left"
      >
        <Chevron open={open} />
        <span className="min-w-0 flex-1 font-semibold leading-snug">
          {title}
        </span>
        {summary ? (
          <span className="shrink-0 text-right text-sm tabular-nums">
            {summary}
          </span>
        ) : null}
      </button>
      {open ? <div className="pb-3">{children}</div> : null}
    </div>
  );
}

/** Legend for the per-row stat abbreviations-free line. */
export function RowsLegend() {
  return (
    <div className={`text-[11px] ${muted}`}>
      Вінрейт — частка виграшних угод; рентабельність (ROI) — прибуток до
      обороту.
    </div>
  );
}

export function rowLine(row: BelowRow, hidden: boolean) {
  return (
    <>
      <span className="whitespace-nowrap">{trades(row.count)}</span> ·{" "}
      <span className="whitespace-nowrap">
        вінрейт {pct(row.winRate, hidden)}
      </span>{" "}
      ·{" "}
      <span className="whitespace-nowrap">
        рентабельність {signedPct(row.roi, hidden)}
      </span>
    </>
  );
}

/** Dense two-level rows: name and result on top, count / win rate / ROI underneath. */
export function RowsList({
  rows,
  hidden,
  empty = "Поки порожньо",
}: {
  rows: BelowRow[];
  hidden: boolean;
  empty?: string;
}) {
  if (!rows.length) return <Empty>{empty}</Empty>;
  return (
    <div className="divide-y divide-foreground/10">
      {rows.map((row) => (
        <div key={row.name} className="py-2 text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate font-medium">{row.label}</span>
            <span
              className={cn(
                "shrink-0 font-semibold tabular-nums",
                !hidden && tone(row.pnl),
              )}
            >
              {signed(row.pnl, hidden)}
            </span>
          </div>
          <div className={`text-xs ${muted}`}>{rowLine(row, hidden)}</div>
        </div>
      ))}
    </div>
  );
}

/** Rows as bars around a zero line: green to the right for profit, red to the left for loss. */
export function BarsList({
  rows,
  hidden,
  empty = "Поки порожньо",
}: {
  rows: BelowRow[];
  hidden: boolean;
  empty?: string;
}) {
  if (!rows.length) return <Empty>{empty}</Empty>;
  const max = Math.max(...rows.map((row) => Math.abs(Number(row.pnl))), 0.01);
  return (
    <div className="grid gap-2.5">
      {rows.map((row) => {
        const value = Number(row.pnl);
        const width = `${(Math.abs(value) / max) * 50}%`;
        return (
          <div key={row.name} className="text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate">
                <span className="font-medium">{row.label}</span>
                <span className={`ml-1.5 text-xs ${muted}`}>
                  {trades(row.count)}
                </span>
              </span>
              <span
                className={cn(
                  "shrink-0 font-semibold tabular-nums",
                  !hidden && tone(value),
                )}
              >
                {signed(value, hidden)}
              </span>
            </div>
            <div className="relative mt-1 h-2 rounded-full bg-foreground/[0.06]">
              <i className="absolute inset-y-[-2px] left-1/2 w-px bg-foreground/25" />
              <i
                className={cn(
                  "absolute inset-y-0 rounded-full",
                  value >= 0 ? "left-1/2 bg-success" : "right-1/2 bg-danger",
                )}
                style={{ width }}
              />
            </div>
            <div className={`mt-0.5 text-[11px] ${muted}`}>
              вінрейт {pct(row.winRate, hidden)} · рентабельність{" "}
              {signedPct(row.roi, hidden)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`rounded-lg border border-dashed border-border p-3 text-center text-sm ${muted}`}
    >
      {children}
    </div>
  );
}

/** Sources: all-time result per source, with the selected month underneath. */
export function SourcesList({ data }: { data: BelowData }) {
  const { hidden } = data;
  return (
    <div className="divide-y divide-foreground/10 md:grid md:grid-cols-3 md:gap-3 md:divide-y-0">
      {data.sources.map((source) => (
        <div
          key={source.key}
          className="py-2 text-sm md:rounded-lg md:bg-muted md:px-3"
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-semibold">{source.label}</span>
            <span
              className={cn(
                "font-semibold tabular-nums",
                !hidden && tone(source.all.pnl),
              )}
            >
              {signed(source.all.pnl, hidden)}
            </span>
          </div>
          <div className={`text-xs ${muted}`}>
            {rowLine(source.all, hidden)}
          </div>
          <div className={`text-xs ${muted}`}>
            За {data.periodLabel}: {trades(source.period.count)}
            {source.period.openCount
              ? ` · ${source.period.openCount} відкритих`
              : ""}{" "}
            ·{" "}
            <span className={hidden ? "" : tone(source.period.pnl)}>
              {signed(source.period.pnl, hidden)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

/** One AI agent per row with its lock; unused slots collapse into a single line. */
export function AgentsList({
  data,
  note = true,
}: {
  data: BelowData;
  note?: boolean;
}) {
  const { hidden } = data;
  return (
    <div className="grid gap-2">
      {note ? (
        <div className={`text-xs ${muted}`}>
          Гроші агента заблоковані на 30 днів: прибуток у грошах
          з&apos;являється після зняття блокування, до того — лише аналітика
          угод.
        </div>
      ) : null}
      {data.agents.map((agent) => (
        <div key={agent.name} className="rounded-lg bg-muted p-3 text-sm">
          <div className="flex items-baseline justify-between gap-2">
            <span className="min-w-0 truncate font-semibold">{agent.name}</span>
            <span
              className={cn(
                "shrink-0 font-semibold tabular-nums",
                !hidden && tone(agent.pnl),
              )}
            >
              {signed(agent.pnl, hidden)}
            </span>
          </div>
          <div className={`text-xs ${muted}`}>
            {trades(agent.count)} · вінрейт {pct(agent.winRate, hidden)} ·
            аналітичний прибуток / збиток
          </div>
          <LockLine agent={agent} hidden={hidden} />
          {agent.releasedCount ? (
            <div className="mt-1 text-xs">
              Знято блокувань: {agent.releasedCount} · результат{" "}
              <span className={hidden ? "" : tone(agent.realized)}>
                {signed(agent.realized, hidden)}
              </span>
            </div>
          ) : null}
        </div>
      ))}
      <EmptySlots count={data.emptyAgentSlots} offset={data.agents.length} />
    </div>
  );
}

export function EmptySlots({
  count,
  offset,
}: {
  count: number;
  offset: number;
}) {
  if (!count) return null;
  const first = offset + 1;
  const last = offset + count;
  return (
    <div
      className={`rounded-lg border border-dashed border-border px-3 py-2 text-xs ${muted}`}
    >
      {first === last ? `Агент ${first}` : `Агенти ${first}–${last}`}: ще не
      підключено
    </div>
  );
}

const LOCK_DAYS = 30;

export function LockLine({
  agent,
  hidden,
}: {
  agent: BelowData["agents"][number];
  hidden: boolean;
}) {
  const { lock } = agent;
  if (!lock)
    return (
      <div className={`mt-2 text-xs ${muted}`}>Активного блокування немає</div>
    );
  // From the server-computed days left, so the bar renders the same on the server and in the browser.
  const share = lock.canRelease
    ? 1
    : Math.min(1, Math.max(0, (LOCK_DAYS - lock.daysLeft) / LOCK_DAYS));
  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 text-xs">
        <span className="whitespace-nowrap">
          Заблоковано {money(lock.amount, hidden)}
        </span>
        <span
          className={cn(
            "whitespace-nowrap",
            lock.canRelease ? "font-semibold text-success" : muted,
          )}
        >
          {lock.canRelease
            ? "Можна виймати"
            : `ще ${lock.daysLeft} дн. з ${LOCK_DAYS}`}{" "}
          · до {kyivDate(lock.unlockAt)}
        </span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-foreground/10">
        <i
          className={cn(
            "block h-full rounded-full",
            lock.canRelease ? "bg-success" : "bg-foreground/50",
          )}
          style={{ width: `${share * 100}%` }}
        />
      </div>
    </div>
  );
}

export function SlippageBlock({ data }: { data: BelowData }) {
  const { slippage, hidden } = data;
  if (!slippage.count)
    return (
      <Empty>
        Додай ціну сигналу (signalPrice) до копі-угод, щоб бачити проковзування
      </Empty>
    );
  return (
    <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
      <div className={`text-xs sm:col-span-3 ${muted}`}>
        Проковзування (slippage) — наскільки ціна входу копії гірша, ніж у
        сигналі лідера.
      </div>
      <Stat
        label="Середня різниця до ціни сигналу"
        value={
          hidden
            ? "••••"
            : `${formatPlain(slippage.avgPoints)} (${formatPercent(slippage.avgPercent)})`
        }
      />
      <Stat
        label="Втрачено на проковзуванні"
        value={money(`-${slippage.costUsd}`, hidden)}
        valueClass="text-danger"
      />
      <Stat
        label="Гірша ціна, ніж у лідера"
        value={hidden ? "••••" : `${slippage.worseCount} з ${slippage.count}`}
      />
    </div>
  );
}

/** Cumulative result line drawn from resolved trades in date order. */
export function cumulative(list: BelowTrade[]) {
  let running = 0;
  return list
    .filter((trade) => trade.status !== "OPEN")
    .map((trade) => ({
      at: trade.resolvedAt ?? trade.openedAt,
      pnl: Number(trade.pnlUsd),
    }))
    .sort((a, b) => a.at.localeCompare(b.at))
    .map((point) => (running += point.pnl));
}

export function Sparkline({
  values,
  className,
}: {
  values: number[];
  className?: string;
}) {
  if (values.length < 2)
    return (
      <div className={cn("h-7 text-[11px]", muted, className)}>
        мало даних для лінії
      </div>
    );
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 1;
  const x = (index: number) => (index / (values.length - 1)) * 100;
  const y = (value: number) => 26 - ((value - min) / span) * 24;
  const last = values[values.length - 1];
  return (
    <svg
      viewBox="0 0 100 28"
      preserveAspectRatio="none"
      className={cn(
        "h-7 w-full",
        last >= 0 ? "text-success" : "text-danger",
        className,
      )}
      aria-hidden
    >
      <line
        x1="0"
        x2="100"
        y1={y(0)}
        y2={y(0)}
        className="stroke-foreground/20"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
        strokeDasharray="2 2"
      />
      <polyline
        points={values
          .map((value, index) => `${x(index)},${y(value)}`)
          .join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const chip = (active: boolean) =>
  cn(
    "whitespace-nowrap rounded-full px-3 py-1 text-xs transition-colors",
    active
      ? "bg-foreground font-semibold text-background"
      : "bg-muted hover:bg-foreground/15",
  );
const selectClass =
  "h-9 w-auto min-w-0 rounded-lg border border-border bg-background px-2.5 py-0 text-xs";

type SortKey = "new" | "old" | "best" | "worst" | "size";
const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: "new", label: "Спочатку нові" },
  { key: "old", label: "Спочатку старі" },
  { key: "best", label: "Найбільший прибуток" },
  { key: "worst", label: "Найбільший збиток" },
  { key: "size", label: "Найбільший розмір" },
];
const dayKey = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", { timeZone: "Europe/Kyiv" });
const dayTitle = (key: string) =>
  new Date(`${key}T12:00:00Z`).toLocaleDateString("uk-UA", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

/**
 * Every trade, at most `pageSize` at a time with "Показати ще": two-level cards on phones,
 * a table from md up. Filters are chips (source, result) plus market / agent / search when `full`.
 */
export function TradeFeed({
  data,
  pageSize = 25,
  filters = "full",
  groupByDay = false,
}: {
  data: BelowData;
  pageSize?: number;
  filters?: "full" | "chips" | "none";
  groupByDay?: boolean;
}) {
  const { hidden } = data;
  const all = data.trades;
  const [source, setSource] = useState("");
  const [status, setStatus] = useState("");
  const [kind, setKind] = useState("");
  const [agent, setAgent] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("new");
  const [shown, setShown] = useState(pageSize);

  const kinds = useMemo(
    () => Array.from(new Set(all.map((trade) => trade.marketKind))).sort(),
    [all],
  );
  const agents = useMemo(
    () =>
      Array.from(
        new Set(
          all
            .map((trade) => trade.agentName)
            .filter((name): name is string => Boolean(name)),
        ),
      ).sort(),
    [all],
  );
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = all.filter(
      (trade) =>
        (!source || trade.section === source) &&
        (!status || trade.status === status) &&
        (!kind || trade.marketKind === kind) &&
        (!agent || trade.agentName === agent) &&
        (!needle ||
          trade.title.toLowerCase().includes(needle) ||
          trade.externalId.toLowerCase().includes(needle)),
    );
    const time = (trade: BelowTrade) => new Date(trade.openedAt).getTime();
    const by: Record<SortKey, (a: BelowTrade, b: BelowTrade) => number> = {
      new: (a, b) => time(b) - time(a),
      old: (a, b) => time(a) - time(b),
      best: (a, b) => Number(b.pnlUsd) - Number(a.pnlUsd),
      worst: (a, b) => Number(a.pnlUsd) - Number(b.pnlUsd),
      size: (a, b) => Number(b.sizeUsd) - Number(a.sizeUsd),
    };
    return rows.sort(
      (a, b) =>
        Number(b.status === "OPEN") - Number(a.status === "OPEN") ||
        by[sort](a, b),
    );
  }, [all, source, status, kind, agent, query, sort]);
  const visible = filtered.slice(0, shown);
  const filteredPnl = filtered.reduce(
    (sum, trade) => sum + Number(trade.pnlUsd),
    0,
  );
  const count = (key: keyof BelowTrade, value: string) =>
    all.filter((trade) => trade[key] === value).length;
  const set = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setShown(pageSize);
  };
  const grouped = groupByDay && (sort === "new" || sort === "old");
  const dayTotals = useMemo(() => {
    const map = new Map<string, { pnl: number; count: number }>();
    for (const trade of filtered) {
      const key = dayKey(trade.openedAt);
      const entry = map.get(key) ?? { pnl: 0, count: 0 };
      entry.pnl += Number(trade.pnlUsd);
      entry.count += 1;
      map.set(key, entry);
    }
    return map;
  }, [filtered]);
  const sections = useMemo(() => {
    const list: Array<{ day: string | null; rows: BelowTrade[] }> = [];
    for (const trade of visible) {
      const day = grouped ? dayKey(trade.openedAt) : null;
      if (!list.length || list[list.length - 1].day !== day)
        list.push({ day, rows: [] });
      list[list.length - 1].rows.push(trade);
    }
    return list;
  }, [visible, grouped]);

  const statusChips = [
    { key: "", label: "Усі" },
    { key: "WON", label: "Виграші" },
    { key: "LOST", label: "Програші" },
    { key: "OPEN", label: "Відкриті" },
    { key: "VOID", label: "Скасовані" },
  ].filter((item) => !item.key || count("status", item.key) > 0);
  const sourceChips = [
    { key: "", label: "Усі джерела" },
    ...(Object.keys(SOURCE_SHORT) as Array<keyof typeof SOURCE_SHORT>).map(
      (key) => ({ key, label: SOURCE_SHORT[key] }),
    ),
  ].filter((item) => !item.key || count("section", item.key) > 0);

  return (
    <div>
      {filters !== "none" ? (
        <div className="mb-3 grid gap-2">
          <div className="flex flex-wrap gap-1.5">
            {statusChips.map((item) => (
              <button
                key={item.key}
                type="button"
                className={chip(status === item.key)}
                onClick={() => set(setStatus)(item.key)}
              >
                {item.label}
                {item.key ? ` ${count("status", item.key)}` : ""}
              </button>
            ))}
          </div>
          {sourceChips.length > 2 ? (
            <div className="flex flex-wrap gap-1.5">
              {sourceChips.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={chip(source === item.key)}
                  onClick={() => set(setSource)(item.key)}
                >
                  {item.label}
                  {item.key ? ` ${count("section", item.key)}` : ""}
                </button>
              ))}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-1.5">
            <select
              className={selectClass}
              value={sort}
              onChange={(event) => setSort(event.target.value as SortKey)}
              aria-label="Сортування"
            >
              {SORTS.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
            {filters === "full" ? (
              <>
                {kinds.length > 1 ? (
                  <select
                    className={selectClass}
                    value={kind}
                    onChange={(event) => set(setKind)(event.target.value)}
                    aria-label="Тип ринку"
                  >
                    <option value="">Усі ринки</option>
                    {kinds.map((value) => (
                      <option key={value} value={value}>
                        {kindLabel(value)}
                      </option>
                    ))}
                  </select>
                ) : null}
                {agents.length ? (
                  <select
                    className={selectClass}
                    value={agent}
                    onChange={(event) => set(setAgent)(event.target.value)}
                    aria-label="Агент"
                  >
                    <option value="">Усі агенти</option>
                    {agents.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                ) : null}
                <input
                  className={`${selectClass} min-w-[8rem] flex-1`}
                  placeholder="Пошук за ринком або номером"
                  value={query}
                  onChange={(event) => set(setQuery)(event.target.value)}
                />
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className={`mb-1 text-xs ${muted}`}>
        {trades(filtered.length)} · результат вибірки{" "}
        <span className={hidden ? "" : tone(filteredPnl)}>
          {signed(filteredPnl, hidden)}
        </span>
      </div>

      {visible.length ? (
        <>
          {/* Phones: two-level rows, nothing wider than the screen. */}
          <div className="md:hidden">
            {sections.map((section, index) => (
              <div key={section.day ?? index}>
                {section.day ? (
                  <DayHeader
                    day={section.day}
                    total={dayTotals.get(section.day)}
                    hidden={hidden}
                  />
                ) : null}
                <div className="divide-y divide-foreground/10">
                  {section.rows.map((trade) => (
                    <TradeCard
                      key={trade.id}
                      trade={trade}
                      hidden={hidden}
                      withDate={!section.day}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
          {/* Wider screens: a regular table. */}
          <table className="hidden w-full [table-layout:fixed] text-left text-sm md:table">
            <thead className={`text-xs ${muted}`}>
              <tr>
                <th className="w-28 py-2 pr-3 font-medium">Відкрито</th>
                <th className="w-32 py-2 pr-3 font-medium">Джерело</th>
                <th className="py-2 pr-3 font-medium">Ринок</th>
                <th className="w-24 py-2 pr-3 text-right font-medium">
                  Ціна входу
                </th>
                <th className="w-28 py-2 pr-3 text-right font-medium">
                  Розмір
                </th>
                <th className="w-28 py-2 pr-3 font-medium">Статус</th>
                <th className="w-32 py-2 text-right font-medium">Результат</th>
              </tr>
            </thead>
            {sections.map((section, index) => (
              <tbody key={section.day ?? index}>
                {section.day ? (
                  <tr>
                    <td colSpan={7} className="pt-3">
                      <DayHeader
                        day={section.day}
                        total={dayTotals.get(section.day)}
                        hidden={hidden}
                      />
                    </td>
                  </tr>
                ) : null}
                {section.rows.map((trade) => (
                  <tr
                    key={trade.id}
                    className="border-t border-foreground/10 align-top"
                  >
                    <td className="whitespace-nowrap py-2 pr-3 text-xs tabular-nums">
                      {kyivStamp(trade.openedAt)}
                    </td>
                    <td className="py-2 pr-3 text-xs">
                      {SOURCE_SHORT[trade.section]}
                      {trade.agentName ? (
                        <div className={`truncate ${muted}`}>
                          {trade.agentName}
                        </div>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3">
                      <div className="truncate font-medium" title={trade.title}>
                        {trade.title}
                      </div>
                      <div className={`truncate text-xs ${muted}`}>
                        {kindLabel(trade.marketKind)} · {trade.outcome}
                        {trade.signalPrice
                          ? ` · ціна сигналу ${formatPlain(trade.signalPrice)}`
                          : ""}
                      </div>
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {formatPlain(trade.entryPrice)}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {money(trade.sizeUsd, hidden)}
                    </td>
                    <td className="py-2 pr-3 text-xs">
                      {STATUS_LABELS[trade.status]}
                      {trade.status === "OPEN" && trade.liveNote ? (
                        <div className={muted}>{trade.liveNote}</div>
                      ) : null}
                    </td>
                    <td
                      className={cn(
                        "py-2 text-right font-semibold tabular-nums",
                        !hidden && tone(trade.pnlUsd),
                      )}
                    >
                      {trade.status === "OPEN"
                        ? "—"
                        : signed(trade.pnlUsd, hidden)}
                    </td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </>
      ) : (
        <Empty>Угод за цими фільтрами немає. Їх заносить OpenClaw.</Empty>
      )}

      {filtered.length > shown ? (
        <button
          type="button"
          className="mt-3 w-full rounded-lg bg-muted py-2 text-sm font-medium hover:bg-foreground/15"
          onClick={() => setShown(shown + pageSize)}
        >
          Показати ще {Math.min(pageSize, filtered.length - shown)} · показано{" "}
          {shown} з {filtered.length}
        </button>
      ) : filtered.length > pageSize ? (
        <div className={`mt-3 text-center text-xs ${muted}`}>
          Показано всі {filtered.length}
        </div>
      ) : null}
    </div>
  );
}

function DayHeader({
  day,
  total,
  hidden,
}: {
  day: string;
  total?: { pnl: number; count: number };
  hidden: boolean;
}) {
  return (
    <div className="mt-2 flex items-baseline justify-between gap-2 rounded-md bg-muted px-2.5 py-1.5 text-xs">
      <span className="font-semibold first-letter:uppercase">
        {dayTitle(day)}
      </span>
      {total ? (
        <span className={muted}>
          {trades(total.count)} ·{" "}
          <span className={cn("font-semibold", !hidden && tone(total.pnl))}>
            {signed(total.pnl, hidden)}
          </span>
        </span>
      ) : null}
    </div>
  );
}

function TradeCard({
  trade,
  hidden,
  withDate,
}: {
  trade: BelowTrade;
  hidden: boolean;
  withDate: boolean;
}) {
  const when = withDate
    ? kyivStamp(trade.openedAt)
    : new Date(trade.openedAt).toLocaleTimeString("uk-UA", {
        timeZone: "Europe/Kyiv",
        hour: "2-digit",
        minute: "2-digit",
      });
  return (
    <div className="py-2 text-sm">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate font-medium" title={trade.title}>
          {shortTitle(trade.title)}
        </span>
        <span
          className={cn(
            "shrink-0 font-semibold tabular-nums",
            trade.status !== "OPEN" && !hidden && tone(trade.pnlUsd),
          )}
        >
          {trade.status === "OPEN"
            ? STATUS_LABELS.OPEN
            : signed(trade.pnlUsd, hidden)}
        </span>
      </div>
      <div className={`mt-0.5 text-xs ${muted}`}>
        {[
          when,
          trade.agentName ?? SOURCE_SHORT[trade.section],
          kindLabel(trade.marketKind),
          `${trade.outcome} по ${formatPlain(trade.entryPrice)}`,
          money(trade.sizeUsd, hidden),
          trade.status !== "OPEN" && STATUS_LABELS[trade.status].toLowerCase(),
          trade.signalPrice && `ціна сигналу ${formatPlain(trade.signalPrice)}`,
        ]
          .filter(Boolean)
          .join(" · ")}
      </div>
      {trade.status === "OPEN" && trade.liveNote ? (
        <div className={`text-xs ${muted}`}>{trade.liveNote}</div>
      ) : null}
    </div>
  );
}
