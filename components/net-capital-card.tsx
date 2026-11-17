import Link from "next/link";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/money";

type Totals = { potentialBankUsdt: string; assetsUsdt: string; debtsOwedUsdt: string; debtsOwedToMeUsdt: string; netCapitalUsdt: string };

/** Net capital = the whole bank + property + money owed to the user − the user's debts, each line explained. */
export function NetCapitalCard({ totals, hidden, rate }: { totals: Totals; hidden: boolean; rate: string }) {
  const rows = [
    { label: "Загальний банк", value: totals.potentialBankUsdt, sign: "", href: "/overview" },
    { label: "Майно", value: totals.assetsUsdt, sign: "+", href: "/assets" },
    { label: "Мені винні", value: totals.debtsOwedToMeUsdt, sign: "+", href: "/debts" },
    { label: "Мої борги", value: totals.debtsOwedUsdt, sign: "−", href: "/debts" }
  ];
  return (
    <Card>
      <div className="flex items-baseline justify-between gap-3">
        <div className="font-semibold">Чистий капітал</div>
        <div className="text-xs text-[hsl(var(--card-muted-foreground))]">курс {formatMoney(rate, "UAH/USDT")}</div>
      </div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{formatMoney(totals.netCapitalUsdt, "USDT", hidden)}</div>
      <div className="mt-3 grid gap-1.5 text-sm">
        {rows.map((row) => (
          <Link key={row.label} href={row.href} className="flex items-center justify-between gap-3 rounded-lg bg-muted/60 px-3 py-2 hover:bg-muted">
            <span className="text-[hsl(var(--card-muted-foreground))]">{row.label}</span>
            <span className="font-semibold tabular-nums">
              {row.sign && <span className="mr-1 text-[hsl(var(--card-muted-foreground))]">{row.sign}</span>}
              {formatMoney(row.value, "USDT", hidden)}
            </span>
          </Link>
        ))}
      </div>
      <p className="mt-2 text-xs text-[hsl(var(--card-muted-foreground))]">Банк + майно + що вам винні − ваші борги. Майно й борги не входять у доступний чи загальний банк і не змінюють доходи та витрати.</p>
    </Card>
  );
}
