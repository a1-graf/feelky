import { formatMoney } from "@/lib/money";
import { isWorkExpenseTransaction } from "@/lib/transaction-utils";

type Expense = {
  id: string;
  amount: { toString(): string } | string;
  currency: string;
  transactionDate: Date;
  note?: string | null;
  sourceAccount?: { name: string } | null;
  category?: { name: string } | null;
  incomeSource?: { name: string } | null;
  metadata?: unknown;
};

export function RecentExpenses({ items, hidden = false }: { items: Expense[]; hidden?: boolean }) {
  if (!items.length) {
    return <div className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-[hsl(var(--card-muted-foreground))]">Витрат поки немає</div>;
  }

  return (
    <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
      {items.map((item) => {
        const work = isWorkExpenseTransaction(item);
        const purpose = item.note?.trim() || (work ? item.incomeSource?.name : item.category?.name) || "Без опису";
        const category = work ? `Робочі · ${item.incomeSource?.name || "Без напрямку"}` : item.category?.name || "Без категорії";
        return (
          <div key={item.id} className="grid gap-2 bg-card px-3 py-3 sm:grid-cols-[7rem_1fr_auto_9rem] sm:items-center sm:px-4">
            <div className="text-xs tabular-nums text-[hsl(var(--card-muted-foreground))]">
              {new Intl.DateTimeFormat("uk-UA", { day: "2-digit", month: "2-digit", year: "2-digit" }).format(new Date(item.transactionDate))}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium" title={purpose}>{purpose}</div>
              <div className="truncate text-xs text-[hsl(var(--card-muted-foreground))]">{category}</div>
            </div>
            <div className="text-sm font-bold tabular-nums text-danger sm:text-right">−{formatMoney(item.amount.toString(), item.currency, hidden)}</div>
            <div className="truncate text-xs text-[hsl(var(--card-muted-foreground))] sm:text-right" title={item.sourceAccount?.name || "Без рахунку"}>
              {item.sourceAccount?.name || "Без рахунку"}
            </div>
          </div>
        );
      })}
    </div>
  );
}
