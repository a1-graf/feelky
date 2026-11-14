import Decimal from "decimal.js";
import { PolyBalanceBlock } from "@/components/poly-balance-block";
import { RangeAreaChart } from "@/components/range-area-chart";
import { Card } from "@/components/ui/card";
import { formatMoney, formatPercent } from "@/lib/money";
import { getPolyOverview, polyBalanceSeries } from "@/lib/poly";
import { polyEquity } from "@/lib/poly-variants";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

const CUR = "$";
const muted = "text-[hsl(var(--card-muted-foreground))]";
const label = `text-[11px] font-medium sm:text-[13px] ${muted}`;
// Trade titles run to 60+ characters and would push the chart tooltip past the card on a phone.
const short = (text: string) => (text.length > 28 ? `${text.slice(0, 27)}…` : text);
const tone = (value: string) => (Number(value) > 0 ? "text-success" : Number(value) < 0 ? "text-danger" : "");

export default async function PolyPage() {
  const userId = await requireUserId();
  const [overview, balanceSeries] = await Promise.all([getPolyOverview(userId), polyBalanceSeries(userId)]);
  const { all, hidden, pool } = overview;
  const equity = polyEquity(overview.trades).points.map((point) => ({ ...point, label: short(point.label) }));
  // summarizePoly rounds the win rate to whole percent; the page shows two decimals, so it is recomputed here.
  const decided = all.wins + all.losses;
  const winRate = decided ? new Decimal(all.wins).div(decided).times(100).toString() : "0";

  return (
    <div className="grid gap-3 sm:gap-4 md:grid-cols-3">
      <Card className="p-3.5 sm:p-4">
        <div className={label}>Оборот</div>
        <div className="mt-1 text-xl font-bold tabular-nums sm:text-2xl">{formatMoney(all.turnover, CUR, hidden)}</div>
      </Card>

      <Card className="grid grid-cols-3 gap-2 p-3.5 sm:p-4 md:col-span-2">
        <div>
          <div className={label}>Угод</div>
          <div className="mt-1 text-xl font-bold tabular-nums sm:text-2xl">{all.count}</div>
        </div>
        <div>
          <div className={label}>Вінрейт</div>
          <div className="mt-1 text-xl font-bold tabular-nums sm:text-2xl">{formatPercent(winRate, hidden)}</div>
        </div>
        <div>
          <div className={label}>ROI тотал</div>
          <div className={`mt-1 text-xl font-bold tabular-nums sm:text-2xl ${hidden ? "" : tone(all.roi)}`}>{formatPercent(all.roi, hidden)}</div>
        </div>
      </Card>

      <Card className="flex h-72 flex-col p-3.5 sm:p-4 md:col-span-2">
        <div className={label}>PnL</div>
        <div className="mt-1 grid flex-1">
          <RangeAreaChart data={equity} currency={CUR} hidden={hidden} totalLabel="PnL" emptyLabel="Поки немає закритих угод" defaultPreset="all" signed showChange={false} />
        </div>
      </Card>

      <PolyBalanceBlock balance={pool.balance} series={balanceSeries} currency={CUR} hidden={hidden} className="h-72 p-3.5 sm:p-4" />
    </div>
  );
}
