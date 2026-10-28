import { ForksBalanceChart } from "@/components/forks-balance-chart";
import { ForksClosed, ForksOpen } from "@/components/forks-list";
import { NetPnlChart } from "@/components/income-line-chart";
import { PeriodPicker } from "@/components/period-picker";
import { Card } from "@/components/ui/card";
import { formatMoney, formatPercent, formatSigned } from "@/lib/money";
import type { ForkSeriesPoint, ForkSummary } from "@/lib/forks-stats";
import type { ResolvedPeriod } from "@/lib/period";

type Dynamic = ForkSummary["byDay"][number];

const tone = (value: string) => (Number(value) > 0 ? "text-success" : Number(value) < 0 ? "text-danger" : "");
const signedMoney = (value: string, hidden: boolean) => `${Number(value) > 0 && !hidden ? "+" : ""}${formatMoney(value, "USD", hidden)}`;
const th = "px-1.5 py-2 sm:px-2 text-xs font-normal text-[hsl(var(--card-muted-foreground))]";
const td = "px-1.5 py-2.5 whitespace-nowrap sm:px-2";

function Tile({ label, value, className = "", sub }: { label: string; value: string; className?: string; sub?: string }) {
  return (
    <div className="flex min-w-0 flex-col justify-center rounded-lg bg-muted px-2 py-3 text-center">
      <div className="text-xs text-[hsl(var(--card-muted-foreground))]">{label}</div>
      <div className={`mt-1 whitespace-nowrap text-lg font-bold tabular-nums sm:text-xl ${className}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs tabular-nums text-[hsl(var(--card-muted-foreground))]">{sub}</div>}
    </div>
  );
}

function DynamicsTable({ title, rows, hidden }: { title: string; rows: Dynamic[]; hidden: boolean }) {
  return (
    <div>
      <div className="mb-2 text-sm font-semibold">{title}</div>
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-0 text-[13px] sm:text-sm">
            <thead>
              <tr className="text-left">
                <th className={th}>Період</th>
                <th className={`${th} text-center`}>Вилок</th>
                <th className={`${th} text-center`}>Прибуток</th>
                <th className={`${th} text-center`}>Нам</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-t border-border/60">
                  <td className={td}>{row.label}</td>
                  <td className={`${td} text-center`}>{row.count}</td>
                  <td className={`${td} text-center ${tone(row.pnl)}`}>{formatSigned(row.pnl, hidden)}</td>
                  <td className={`${td} text-center ${tone(row.net)}`}>{formatSigned(row.net, hidden)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-[hsl(var(--card-muted-foreground))]">Поки порожньо</div>
      )}
    </div>
  );
}

export function ForksStatistics({ stats, allTime, series, period, hidden = false }: { stats: ForkSummary; allTime: ForkSummary; series: ForkSeriesPoint[]; period: ResolvedPeriod; hidden?: boolean }) {
  return (
    <>
      <Card className="mt-0 md:mt-4">
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          <Tile label="Весь час · прибуток" value={signedMoney(allTime.pnl, hidden)} className={tone(allTime.pnl)} sub={`${allTime.count} вилок`} />
          <Tile label="Весь час · нам чистими" value={signedMoney(allTime.net, hidden)} className={tone(allTime.net)} sub={`Багірі ${formatMoney(allTime.bagiraFee, "USD", hidden)}`} />
          <div className="col-span-2">
            <ForksBalanceChart data={series} hidden={hidden} />
          </div>
        </div>
      </Card>

      <div className="mt-4">
        <PeriodPicker basePath="/forks" period={period} presets={["week", "month", "3m", "6m", "12m", "all"]} />
      </div>

      <Card className="mt-4">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <div className="font-semibold">Статистика</div>
          <div className="text-xs text-[hsl(var(--card-muted-foreground))]">{period.rangeLabel}</div>
        </div>
        {stats.count ? (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
            <Tile label="Прибуток" value={signedMoney(stats.pnl, hidden)} className={tone(stats.pnl)} />
            <Tile label="Нам чистими" value={signedMoney(stats.net, hidden)} className={tone(stats.net)} />
            <Tile label="Комісія Багіри 40%" value={formatMoney(stats.bagiraFee, "USD", hidden)} />
            <Tile label="Вилок" value={String(stats.count)} sub={hidden ? undefined : `${stats.wins} плюс / ${stats.losses} мінус`} />
            <Tile label="Обіг" value={formatMoney(stats.turnover, "USD", hidden)} />
            <Tile label="Win-rate" value={hidden ? "••••" : formatPercent(stats.winRate)} />
            <Tile label="Середній %" value={hidden ? "••••" : formatPercent(stats.avgPercent)} className={tone(stats.avgPercent)} />
            <Tile label="Зважений %" value={hidden ? "••••" : formatPercent(stats.weightedPercent)} className={tone(stats.weightedPercent)} sub="прибуток / обіг" />
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-[hsl(var(--card-muted-foreground))]">За цей період закритих вилок немає.</div>
        )}
      </Card>

      <Card className="mt-4">
        <div className="mb-3 font-semibold">Прибуток по днях (накопичений)</div>
        <NetPnlChart data={stats.timeline} hidden={hidden} currency="USD" cumulativeOnly />
      </Card>

      <Card className="mt-4">
        <div className="grid gap-5 md:grid-cols-2">
          <DynamicsTable title="По днях" rows={stats.byDay} hidden={hidden} />
          <DynamicsTable title="По тижнях" rows={stats.byWeek} hidden={hidden} />
        </div>
      </Card>

      <ForksOpen items={allTime.open.items} stake={allTime.open.stake} guaranteed={allTime.open.guaranteed} hidden={hidden} />
      <ForksClosed items={stats.settled} hidden={hidden} />
    </>
  );
}
