import Decimal from "decimal.js";
import { PolyTop } from "@/components/poly-top";
import { BigTile, Half, SplitTile } from "@/components/stat-tiles";
import { Card } from "@/components/ui/card";
import type { FxBalancePoint } from "@/lib/fx-stats";
import { formatMoney, formatPercent, formatSigned, formatSignedPercent } from "@/lib/money";
import { getPolyOverview, polyBalanceSeries } from "@/lib/poly";
import { polyEquity } from "@/lib/poly-variants";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

const CUR = "USD";
// Trade titles run to 60+ characters and would push the chart tooltip past the tile on a phone.
const short = (text: string) => (text.length > 28 ? `${text.slice(0, 27)}…` : text);
const tone = (value: string) => (Number(value) >= 0 ? "text-success" : "text-danger");
const MONTH_MS = 30 * 86_400_000;
// Four figures: a column on a phone (a half-width tile is too narrow for two), 2x2 on desktop where the borders meet in a cross.
const RULE = "mt-2.5 border-t-2 border-foreground/70 pt-2.5 lg:mt-0 lg:self-stretch";
const EDGE = { top: "lg:self-stretch lg:pb-3", topRight: `${RULE} lg:border-l-2 lg:border-t-0 lg:pb-3 lg:pt-0`, bottom: `${RULE} lg:pt-3`, bottomRight: `${RULE} lg:border-l-2 lg:pt-3` };

/** Top of /poly laid out like the top of /fx: one card, one period switcher for the charts, four muted tiles (balance, trades/win rate/ROI/month PnL, PnL chart, turnover). */
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
  // PnL of trades whose result landed in the last 30 days (the same result date the PnL chart plots).
  const monthFrom = Date.now() - MONTH_MS;
  const monthPnl = overview.trades
    .filter((trade) => trade.status !== "OPEN" && new Date(trade.resolvedAt ?? trade.openedAt).getTime() >= monthFrom)
    .reduce((sum, trade) => sum.plus(trade.pnlUsd), new Decimal(0))
    .toString();

  return (
    <Card>
      <PolyTop
        balance={pool.balance}
        balanceSeries={balanceSeries}
        pnlSeries={pnlSeries}
        currency={CUR}
        hidden={hidden}
        stats={
          <SplitTile>
            <Half label="Угод" main={all.count} edge={EDGE.top} />
            <Half label="Вінрейт" main={formatPercent(winRate, hidden)} edge={EDGE.topRight} />
            <Half label="ROI тотал" className={hidden ? "" : tone(all.roi)} main={formatSignedPercent(all.roi, hidden)} edge={EDGE.bottom} />
            <Half label="PnL за місяць" className={hidden ? "" : tone(monthPnl)} main={hidden ? "••••" : `${formatSigned(monthPnl)} ${CUR}`} edge={EDGE.bottomRight} />
          </SplitTile>
        }
        turnover={<BigTile label="Оборот">{formatMoney(all.turnover, CUR, hidden)}</BigTile>}
      />
    </Card>
  );
}
