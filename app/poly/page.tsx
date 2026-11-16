import Decimal from "decimal.js";
import { DayPnl, TitleWithDayPnl } from "@/components/day-pnl";
import { PageTitle } from "@/components/page-title";
import { PolyDayCalendar } from "@/components/poly-day-calendar";
import { PolyStatistics } from "@/components/poly-statistics";
import { toBelowData } from "@/components/poly-below-variants/data";
import { BelowV1 } from "@/components/poly-below-variants/v1";
import { BelowV2 } from "@/components/poly-below-variants/v2";
import { BelowV3 } from "@/components/poly-below-variants/v3";
import { BelowV4 } from "@/components/poly-below-variants/v4";
import { BelowV5 } from "@/components/poly-below-variants/v5";
import { BelowM1 } from "@/components/poly-below-min/m1";
import { BelowM2 } from "@/components/poly-below-min/m2";
import { BelowM3 } from "@/components/poly-below-min/m3";
import { BelowM4 } from "@/components/poly-below-min/m4";
import { BelowM5 } from "@/components/poly-below-min/m5";
import { PolyTop } from "@/components/poly-top";
import { BigTile, Half, SplitTile } from "@/components/stat-tiles";
import { Card } from "@/components/ui/card";
import type { FxBalancePoint } from "@/lib/fx-stats";
import { formatMoney, formatPercent, formatSigned, formatSignedPercent } from "@/lib/money";
import { kyivDayKey, lastDaysPnl } from "@/lib/day-pnl";
import { getPolyOverview, polyBalanceSeries } from "@/lib/poly";
import { polyEquity } from "@/lib/poly-variants";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

const CUR = "USD";
// Trade titles run to 60+ characters and would push the chart tooltip past the tile on a phone.
const short = (text: string) => (text.length > 28 ? `${text.slice(0, 27)}…` : text);
const tone = (value: string) => (Number(value) >= 0 ? "text-success" : "text-danger");
const MONTH_MS = 30 * 86_400_000;
// Trial layouts of everything under the day calendar, picked with ?v=1..5 (and their minimal takes ?v=m1..m5).
const BELOW_VARIANTS = {
  "1": BelowV1, "2": BelowV2, "3": BelowV3, "4": BelowV4, "5": BelowV5,
  m1: BelowM1, m2: BelowM2, m3: BelowM3, m4: BelowM4, m5: BelowM5,
} as const;
// Four figures as a 2x2 square on every screen; hairline rules meet in a cross between the cells.
const RULE = "self-stretch border-foreground/15";
const EDGE = { top: `${RULE} pb-2.5 sm:pb-3`, topRight: `${RULE} border-l pb-2.5 sm:pb-3`, bottom: `${RULE} border-t pt-2.5 sm:pt-3`, bottomRight: `${RULE} border-l border-t pt-2.5 sm:pt-3` };

/** Top of /poly laid out like the top of /fx: one card, one period switcher for the charts, four muted tiles (balance, trades/win rate/ROI/month PnL, PnL chart, turnover). */
export default async function PolyPage({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  const { v } = await searchParams;
  const Below = v && v in BELOW_VARIANTS ? BELOW_VARIANTS[v as keyof typeof BELOW_VARIANTS] : null;
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

  const dayPnl = lastDaysPnl(overview.all.timeline.map((point) => ({ date: point.date, pnl: point.pnl })));

  return (
    <>
      <TitleWithDayPnl
        title={
          <div className="hidden md:block">
            <PageTitle className="mb-0" title="Polymarket" subtitle="Вручну, копітрейд і три AI-агенти: PnL по днях, угоди, ризики й блокування" />
          </div>
        }
      >
        <DayPnl days={dayPnl} currency={CUR} hidden={hidden} />
      </TitleWithDayPnl>
      <Card>
      <PolyTop
        balance={pool.balance}
        balanceSeries={balanceSeries}
        pnlSeries={pnlSeries}
        currency={CUR}
        hidden={hidden}
        stats={
          <SplitTile className="grid-cols-2">
            <Half compact label="Угод" main={all.count} edge={EDGE.top} />
            <Half compact label="Вінрейт" main={formatPercent(winRate, hidden)} edge={EDGE.topRight} />
            <Half compact label="ROI тотал" className={hidden ? "" : tone(all.roi)} main={formatSignedPercent(all.roi, hidden)} edge={EDGE.bottom} />
            <Half compact label="PnL за місяць" className={hidden ? "" : tone(monthPnl)} main={hidden ? "••••" : `${formatSigned(monthPnl)} ${CUR}`} edge={EDGE.bottomRight} />
          </SplitTile>
        }
        turnover={<BigTile label="Оборот">{formatMoney(all.turnover, CUR, hidden)}</BigTile>}
      />
      </Card>
      <PolyDayCalendar days={overview.days} today={kyivDayKey(new Date())} currency={CUR} hidden={hidden} />
      {Below ? <Below data={toBelowData(overview)} /> : <PolyStatistics overview={overview} below />}
    </>
  );
}
