import { BreakdownBars } from "@/components/breakdown-bars";
import { PageTitle } from "@/components/page-title";
import { Card } from "@/components/ui/card";
import { DrawdownChart } from "@/components/poly-variants/drawdown-chart";
import { PolyVariantNav } from "@/components/poly-variants/variant-nav";
import { CUR, Metric, kyivDate, muted, plural, tone } from "@/components/poly-variants/ui";
import { D, formatMoney, formatPercent, formatSigned } from "@/lib/money";
import { getPolyVariantsData, polyDays, polyEquity, polyStreaks } from "@/lib/poly-variants";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

const share = (part: string, whole: string) => (D(whole).gt(0) ? D(part).div(D(whole)).times(100).toString() : "0");

/** Variant 4: a risk panel — drawdown, money at risk right now, the worst day and the losing streaks. */
export default async function PolyV4Page() {
  const userId = await requireUserId();
  const { overview, money } = await getPolyVariantsData(userId);
  const { all, hidden, locks } = overview;
  const equity = polyEquity(overview.trades);
  const streaks = polyStreaks(overview.trades);
  const days = polyDays(overview.trades);
  const worstDay = days[0];
  const stakes = overview.trades.map((trade) => D(trade.sizeUsd));
  const maxStake = stakes.reduce((max, value) => (value.gt(max) ? value : max), D(0));
  const avgStake = stakes.length ? stakes.reduce((sum, value) => sum.plus(value), D(0)).div(stakes.length) : D(0);
  const atRisk = D(all.openExposure).plus(money.locked).toString();
  const nextUnlock = locks.filter((lock) => lock.status === "LOCKED").sort((a, b) => a.unlockAt.localeCompare(b.unlockAt))[0];
  const streakText = (kind: "WON" | "LOST", length: number) => `${length} ${kind === "WON" ? plural(length, "виграш", "виграші", "виграшів") : plural(length, "програш", "програші", "програшів")} поспіль`;

  return (
    <>
      <PageTitle title="Polymarket" subtitle="Варіант 4 · ризики: просадка, гроші під ризиком, найгірші дні й серії" />
      <PolyVariantNav current="/poly/v4" />

      <Card>
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric
            label="Найбільша просадка"
            value={formatMoney(equity.maxDrawdown, CUR, hidden)}
            className="text-danger"
            hint={`${formatPercent(share(equity.maxDrawdown, money.netIn), hidden)} від внесеного${equity.maxDrawdownAt ? ` · ${kyivDate(equity.maxDrawdownAt)}` : ""}`}
          />
          <Metric
            label="Просадка зараз (від піку)"
            value={formatMoney(equity.currentDrawdown, CUR, hidden)}
            className={D(equity.currentDrawdown).gt(0) ? "text-danger" : ""}
            hint={`пік накопиченого результату ${hidden ? "••••" : `${formatSigned(equity.peak)} ${CUR}`}`}
          />
          <Metric label="Під ризиком зараз" value={formatMoney(atRisk, CUR, hidden)} hint={`${formatPercent(share(atRisk, money.now), hidden)} банку: відкриті угоди та вклад в агенті`} />
        </div>
        <div className="mt-4 mb-1 text-sm font-semibold">Наскільки результат був нижче свого піку після кожної угоди</div>
        <DrawdownChart data={equity.underwater} hidden={hidden} />
      </Card>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card>
          <div className="mb-3 font-semibold">Експозиція</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <Metric label="У відкритих угодах" value={formatMoney(all.openExposure, CUR, hidden)} hint={`${all.openCount} ${plural(all.openCount, "угода", "угоди", "угод")}`} />
            <Metric
              label="Вклад в AI-агенті"
              value={formatMoney(money.locked, CUR, hidden)}
              hint={nextUnlock ? `розблокування ${kyivDate(nextUnlock.unlockAt)}, ще ${nextUnlock.daysLeft} ${plural(nextUnlock.daysLeft, "день", "дні", "днів")}` : "немає"}
            />
            <Metric label="Найбільша ставка" value={formatMoney(maxStake.toString(), CUR, hidden)} hint={`${formatPercent(share(maxStake.toString(), money.netIn), hidden)} від внесеного`} />
            <Metric label="Середня ставка" value={formatMoney(avgStake.toString(), CUR, hidden)} />
          </div>
        </Card>

        <Card>
          <div className="mb-3 font-semibold">Серії та денні втрати</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <Metric label="Найдовша серія програшів" value={`${streaks.longestLoss}`} hint={`найгірша серія коштувала ${hidden ? "••••" : `${formatSigned(streaks.worstLossRunUsd)} ${CUR}`}`} />
            <Metric label="Найдовша серія виграшів" value={`${streaks.longestWin}`} />
            <Metric
              label="Остання серія"
              value={streaks.current ? streakText(streaks.current.kind, streaks.current.length) : "—"}
              className={streaks.current?.kind === "LOST" ? "text-danger" : streaks.current ? "text-success" : ""}
            />
            <Metric label="Найбільший програш угоди" value={all.worst ? formatMoney(all.worst.pnl, CUR, hidden) : "—"} className="text-danger" hint={all.worst ? kyivDate(all.worst.resolvedAt) : undefined} />
            <Metric
              label="Найгірший день"
              value={worstDay ? formatMoney(worstDay.pnl, CUR, hidden) : "—"}
              className={worstDay ? tone(worstDay.pnl) : ""}
              hint={worstDay ? `${kyivDate(`${worstDay.name}T12:00:00Z`)} · ${worstDay.count} ${plural(worstDay.count, "угода", "угоди", "угод")}` : undefined}
            />
            <Metric label="Сьогодні" value={formatMoney(all.todayPnl, CUR, hidden)} className={tone(all.todayPnl)} hint="денний ліміт збитку в Feelky не задано" />
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <div className="mb-1 font-semibold">Дні від найгіршого</div>
        <div className={`mb-3 text-xs ${muted}`}>Результат закритих угод за кожен день (за київським часом)</div>
        <BreakdownBars items={days.map((day) => ({ name: `${kyivDate(`${day.name}T12:00:00Z`)} · ${day.count} ${plural(day.count, "угода", "угоди", "угод")}`, value: Number(day.pnl) }))} hidden={hidden} />
      </Card>
    </>
  );
}
