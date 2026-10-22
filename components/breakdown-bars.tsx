import { formatMoney } from "@/lib/money";

/** Signed bars (profit green, loss red) measured against the largest absolute value. */
export function BreakdownBars({ items, currency = "USDT", hidden = false }: { items: { name: string; value: number }[]; currency?: string; hidden?: boolean }) {
  const max = Math.max(...items.map((item) => Math.abs(item.value)), 0);
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.name}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span>{item.name}</span>
            <span className={`font-medium tabular-nums ${item.value > 0 ? "text-success" : item.value < 0 ? "text-danger" : "text-[hsl(var(--card-muted-foreground))]"}`}>
              {hidden ? "••••" : `${item.value > 0 ? "+" : ""}${formatMoney(item.value, currency)}`}
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className={`h-full rounded-full ${item.value < 0 ? "bg-danger" : "bg-success"}`} style={{ width: max ? `${Math.max(Math.abs(item.value) / max * 100, item.value ? 2 : 0)}%` : "0%" }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
