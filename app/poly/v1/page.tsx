import { Card } from "@/components/ui/card";
import { PageTitle } from "@/components/page-title";
import { RangeAreaChart } from "@/components/range-area-chart";
import { PolyVariantNav } from "@/components/poly-variants/variant-nav";
import { CUR, muted, plural, tone } from "@/components/poly-variants/ui";
import { formatMoney, formatSigned } from "@/lib/money";
import { getPolyVariantsData, polyEquity } from "@/lib/poly-variants";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Variant 1: the bare minimum — one result, one bank figure, one curve. */
export default async function PolyV1Page() {
  const userId = await requireUserId();
  const { overview, money } = await getPolyVariantsData(userId);
  const { all, hidden } = overview;
  const equity = polyEquity(overview.trades);

  return (
    <>
      <PageTitle title="Polymarket" subtitle="Варіант 1 · мінімум: результат, банк і графік" />
      <PolyVariantNav current="/poly/v1" />

      <Card>
        <div className={`text-sm ${muted}`}>Результат усіх закритих угод</div>
        <div className={`mt-1 text-4xl font-bold tabular-nums ${tone(all.totalPnl)}`}>
          {hidden ? "••••" : `${formatSigned(all.totalPnl)} ${CUR}`}
        </div>
        <div className={`mt-1 text-sm ${muted}`}>
          {all.count} {plural(all.count, "угода", "угоди", "угод")} · {all.wins} виграшних, {all.losses} програшних
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 border-t border-border pt-4">
          <div>
            <div className={`text-xs ${muted}`}>Банк зараз</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">{formatMoney(money.now, CUR, hidden)}</div>
            <div className={`text-xs ${muted}`}>
              вільно {formatMoney(money.free, CUR, hidden)} · вклад в AI-агенті {formatMoney(money.locked, CUR, hidden)}
            </div>
          </div>
          <div>
            <div className={`text-xs ${muted}`}>Внесено мінус виведено</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">{formatMoney(money.netIn, CUR, hidden)}</div>
            <div className={`text-xs ${tone(money.change)}`}>{hidden ? "••••" : `${formatSigned(money.change)} ${CUR} до внесеного`}</div>
          </div>
        </div>
      </Card>

      <Card className="mt-4">
        <div className="mb-2 font-semibold">Накопичений результат</div>
        <RangeAreaChart data={equity.points} hidden={hidden} totalLabel="Результат" emptyLabel="Поки немає закритих угод" defaultPreset="all" signed smooth showSummary={false} />
      </Card>
    </>
  );
}
