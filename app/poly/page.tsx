import Decimal from "decimal.js";
import { FxBalanceChart } from "@/components/fx-balance-chart";
import { PolyBalanceBlock } from "@/components/poly-balance-block";
import { BigTile, Half, SplitTile } from "@/components/stat-tiles";
import { Card } from "@/components/ui/card";
import type { FxBalancePoint } from "@/lib/fx-stats";
import { formatMoney, formatPercent, formatSignedPercent } from "@/lib/money";
import { getPolyOverview, polyBalanceSeries } from "@/lib/poly";
import { polyEquity } from "@/lib/poly-variants";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

const CUR = "USD";
// Trade titles run to 60+ characters and would push the chart tooltip past the tile on a phone.
const short = (text: string) => (text.length > 28 ? `${text.slice(0, 27)}…` : text);
const tone = (value: string) => (Number(value) >= 0 ? "text-success" : "text-danger");

/** Top of /poly laid out like the top of /fx: one card, four muted tiles (balance, trades/win rate/ROI, PnL chart, turnover). */
export default async function PolyPage() {
  const userId = await requireUserId();
  const [overview, balanceRows] = await Promise.all([getPolyOverview(userId), polyBalanceSeries(userId)]);
  const { all, hidden, pool } = overview;
  // The /fx chart draws `balance`; for the PnL tile that is the running PnL, which `total` already holds.
  const pnlSeries: FxBalancePoint[] = polyEquity(overview.trades).points.map((point) => ({ ...point, balance: point.total, kind: "trade", label: short(point.label) }));
  const balanceSeries: FxBalancePoint[] = balanceRows.map((row) => ({ ...row, balance: row.total, kind: "trade" }));
  // summarizePoly rounds the win rate to whole percent; the page shows two decimals, so it is recomputed here.
  const decided = all.wins + all.losses;
  const winRate = decided ? new Decimal(all.wins).div(decided).times(100).toString() : "0";

  return (
    <Card>
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
        <PolyBalanceBlock balance={pool.balance} series={balanceSeries} currency={CUR} hidden={hidden} />
        <SplitTile className="lg:grid-cols-3">
          <Half label="Угод" main={all.count} />
          <Half label="Вінрейт" main={formatPercent(winRate, hidden)} divider />
          <Half label="ROI тотал" className={hidden ? "" : tone(all.roi)} main={formatSignedPercent(all.roi, hidden)} divider />
        </SplitTile>
        <FxBalanceChart data={pnlSeries} currency={CUR} oneR={0} hidden={hidden} title="PnL" showTotal={false} />
        <BigTile label="Оборот">{formatMoney(all.turnover, CUR, hidden)}</BigTile>
      </div>
    </Card>
  );
}
