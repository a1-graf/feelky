"use client";

import { useMemo, useState } from "react";
import { TransactionList, type TransactionItem } from "@/components/transaction-list";
import { isWorkExpenseTransaction } from "@/lib/transaction-utils";

export function TransactionExplorer({ items, hidden = false }: { items: TransactionItem[]; hidden?: boolean }) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("uk-UA");
    return items.filter((item) => {
      const work = isWorkExpenseTransaction(item);
      if (kind === "personal" && work) return false;
      if (kind === "work" && !work) return false;
      if (!needle) return true;
      return [item.note, item.category?.name, item.incomeSource?.name, item.sourceAccount?.name, item.destinationAccount?.name]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("uk-UA").includes(needle));
    });
  }, [items, kind, query]);

  return (
    <div>
      <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_11rem]">
        <label className="text-xs text-[hsl(var(--card-muted-foreground))]">
          Пошук
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Навіщо, куди, категорія…" className="mt-1" />
        </label>
        <label className="text-xs text-[hsl(var(--card-muted-foreground))]">
          Тип
          <select value={kind} onChange={(event) => setKind(event.target.value)} className="mt-1">
            <option value="all">Усі витрати</option>
            <option value="personal">Особисті</option>
            <option value="work">Робочі</option>
          </select>
        </label>
      </div>
      <div className="mb-2 text-xs text-[hsl(var(--card-muted-foreground))]">Знайдено: {filtered.length}</div>
      <TransactionList items={filtered} compact hidden={hidden} />
    </div>
  );
}
