import { TransactionType } from "@prisma/client";
import { ArchiveAction } from "@/components/archive-action";
import { formatMoney } from "@/lib/money";

type Item = {
  id: string;
  type: TransactionType;
  amount: { toString(): string } | string;
  currency: string;
  convertedAmount?: { toString(): string } | string | null;
  convertedCurrency?: string | null;
  note?: string | null;
  transactionDate: Date;
  archivedAt?: Date | null;
  sourceAccount?: { name: string } | null;
  destinationAccount?: { name: string } | null;
  category?: { name: string } | null;
  incomeSource?: { name: string } | null;
};

const labels: Record<string, string> = {
  INCOME: "Дохід",
  EXPENSE: "Витрата",
  P2P_WITHDRAWAL: "P2P-вивід",
  CASH_WITHDRAWAL: "Готівковий вивід",
  MANUAL_ADJUSTMENT: "Зміна балансу",
  EXPECTED_MONEY_RECEIVED: "Отримано очікувані",
  FUNDS_FROZEN: "Заморожено",
  FUNDS_RELEASED: "Розморожено",
  TRANSFER: "Переказ"
};

export function TransactionList({ items, archiveMode = false, compact = false }: { items: Item[]; archiveMode?: boolean; compact?: boolean }) {
  if (!items.length) {
    return <div className={`rounded-lg border border-dashed border-border text-center text-sm text-muted-foreground ${compact ? "p-4" : "p-8"}`}>Операцій поки немає</div>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      {items.map((item) => (
        <div key={item.id} className={`grid border-b border-border last:border-b-0 ${compact ? "grid-cols-[1fr_auto] items-center gap-2 p-2.5" : "gap-2 p-4 md:grid-cols-[1fr_auto_auto] md:items-center"}`}>
          <div>
            <div className={compact ? "text-sm font-medium leading-tight" : "font-medium"}>{labels[item.type] || item.type}</div>
            <div className={`text-muted-foreground ${compact ? "text-xs leading-tight" : "text-sm"}`}>
              {new Intl.DateTimeFormat("uk-UA").format(new Date(item.transactionDate))}
              {item.category?.name ? ` · ${item.category.name}` : ""}
              {item.incomeSource?.name ? ` · ${item.incomeSource.name}` : ""}
              {item.note ? ` · ${item.note}` : ""}
            </div>
          </div>
          <div className={`text-right font-semibold ${compact ? "text-sm leading-tight" : ""}`}>
            {formatMoney(item.amount.toString(), item.currency)}
            {item.convertedAmount && item.convertedCurrency ? <div className="text-xs text-muted-foreground">{formatMoney(item.convertedAmount.toString(), item.convertedCurrency)}</div> : null}
          </div>
          {compact ? null : <ArchiveAction transactionId={item.id} archived={Boolean(item.archivedAt || archiveMode)} />}
        </div>
      ))}
    </div>
  );
}
