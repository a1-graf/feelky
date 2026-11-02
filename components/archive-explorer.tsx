"use client";

import { useMemo, useState } from "react";
import Decimal from "decimal.js";
import { ArchiveAction } from "@/components/archive-action";
import { formatMoney } from "@/lib/money";

export type ArchivedItem = {
  id: string;
  type: string;
  amount: string;
  currency: string;
  note: string | null;
  transactionDate: string;
  archivedAt: string;
  source: string | null;
  destination: string | null;
  category: string | null;
  incomeSource: string | null;
};

const labels: Record<string, string> = {
  INCOME: "Дохід", EXPENSE: "Витрата", P2P_WITHDRAWAL: "P2P-вивід", P2P_DEPOSIT: "P2P-завод",
  CASH_WITHDRAWAL: "Готівковий вивід", MANUAL_ADJUSTMENT: "Зміна балансу", EXPECTED_MONEY_RECEIVED: "Отримано очікувані",
  FUNDS_FROZEN: "Заморожено", FUNDS_RELEASED: "Розморожено", TRANSFER: "Переказ"
};

function monthKey(value: string) {
  return new Intl.DateTimeFormat("uk-UA", { year: "numeric", month: "long", timeZone: "Europe/Kyiv" }).format(new Date(value));
}

export function ArchiveExplorer({ items }: { items: ArchivedItem[] }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [currency, setCurrency] = useState("all");
  const types = useMemo(() => Array.from(new Set(items.map((item) => item.type))).sort(), [items]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("uk-UA");
    return items.filter((item) => {
      if (type !== "all" && item.type !== type) return false;
      if (currency !== "all" && item.currency !== currency) return false;
      if (!needle) return true;
      return [labels[item.type], item.note, item.source, item.destination, item.category, item.incomeSource]
        .filter(Boolean).some((value) => String(value).toLocaleLowerCase("uk-UA").includes(needle));
    });
  }, [currency, items, query, type]);
  const groups = useMemo(() => {
    const map = new Map<string, ArchivedItem[]>();
    for (const item of filtered) {
      const key = monthKey(item.archivedAt);
      map.set(key, [...(map.get(key) || []), item]);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <>
      <div className="grid gap-2 rounded-xl border border-border bg-card p-3 sm:grid-cols-[1fr_12rem_9rem]">
        <label className="text-xs text-[hsl(var(--card-muted-foreground))]">Пошук<input className="mt-1" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Опис, категорія, рахунок…" /></label>
        <label className="text-xs text-[hsl(var(--card-muted-foreground))]">Тип<select className="mt-1" value={type} onChange={(event) => setType(event.target.value)}><option value="all">Усі типи</option>{types.map((value) => <option key={value} value={value}>{labels[value] || value}</option>)}</select></label>
        <label className="text-xs text-[hsl(var(--card-muted-foreground))]">Валюта<select className="mt-1" value={currency} onChange={(event) => setCurrency(event.target.value)}><option value="all">Усі</option><option>UAH</option><option>USDT</option><option>USD</option></select></label>
      </div>
      <div className="mt-2 text-xs text-[hsl(var(--card-muted-foreground))]">Знайдено: {filtered.length}</div>
      <div className="mt-4 grid gap-5">
        {groups.map(([month, rows]) => {
          const totals = rows.reduce((map, row) => map.set(row.currency, (map.get(row.currency) || new Decimal(0)).plus(row.amount)), new Map<string, Decimal>());
          return (
            <section key={month}>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-semibold capitalize">{month}</h2>
                <div className="text-xs text-[hsl(var(--card-muted-foreground))]">{rows.length} операцій · {Array.from(totals).map(([cur, value]) => formatMoney(value, cur)).join(" · ")}</div>
              </div>
              <div className="overflow-hidden rounded-xl border border-border bg-card">
                {rows.map((item) => (
                  <div key={item.id} className="grid gap-2 border-b border-border p-3 last:border-0 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                    <div className="min-w-0">
                      <div className="font-medium">{labels[item.type] || item.type}</div>
                      <div className="truncate text-xs text-[hsl(var(--card-muted-foreground))]">{new Date(item.transactionDate).toLocaleDateString("uk-UA")} · {[item.category, item.incomeSource, item.note, item.source && item.destination ? `${item.source} → ${item.destination}` : item.source || item.destination].filter(Boolean).join(" · ") || "Без опису"}</div>
                    </div>
                    <div className="font-semibold tabular-nums">{formatMoney(item.amount, item.currency)}</div>
                    <ArchiveAction transactionId={item.id} archived />
                  </div>
                ))}
              </div>
            </section>
          );
        })}
        {!groups.length && <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-[hsl(var(--card-muted-foreground))]">За цими фільтрами нічого немає</div>}
      </div>
    </>
  );
}
