import { NetPnlChart } from "@/components/income-line-chart";
import { PolyTradesTable } from "@/components/poly-trades-table";
import { Card } from "@/components/ui/card";
import { formatMoney, formatPercent, formatPlain } from "@/lib/money";
import type { getPolyOverview } from "@/lib/poly";
import { POLY_SECTION_LABELS } from "@/lib/poly-stats";
import type { PolySectionKey } from "@/lib/poly-stats";

type Overview = Awaited<ReturnType<typeof getPolyOverview>>;
type Stats = Overview["all"];
type Row = Stats["byMarketKind"][number];

const CUR = "USDT";
const tone = (value: string) => (Number(value) > 0 ? "text-success" : Number(value) < 0 ? "text-danger" : "");
const muted = "text-[hsl(var(--card-muted-foreground))]";
const AGENT_SLOTS = 3;

function Metric({ label, value, className = "" }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className="rounded-lg bg-muted p-3">
      <div className={`text-xs ${muted}`}>{label}</div>
      <div className={`mt-1 font-semibold ${className}`}>{value}</div>
    </div>
  );
}

function Breakdown({ title, rows, hidden, empty = "Поки порожньо" }: { title: string; rows: Row[]; hidden: boolean; empty?: string }) {
  return (
    <div>
      <div className="mb-2 text-sm font-semibold">{title}</div>
      {rows.length ? (
        <div className="grid gap-2">
          {rows.map((row) => (
            <div key={row.name} className="flex items-center justify-between gap-3 rounded-lg bg-muted p-3 text-sm">
              <div className="min-w-0">
                <div className="truncate font-medium">{row.name}</div>
                <div className={`text-xs ${muted}`}>
                  {row.count} угод · winrate {hidden ? "****" : formatPercent(row.winRate)} · ROI {hidden ? "****" : formatPercent(row.roi)}
                </div>
              </div>
              <div className={`shrink-0 font-semibold ${tone(row.pnl)}`}>{formatMoney(row.pnl, CUR, hidden)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className={`rounded-lg border border-dashed border-border p-4 text-center text-sm ${muted}`}>{empty}</div>
      )}
    </div>
  );
}

function SectionCard({ section, stats, hidden }: { section: PolySectionKey; stats: Stats; hidden: boolean }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">{POLY_SECTION_LABELS[section]}</div>
          <div className={`mt-1 text-xs ${muted}`}>
            {stats.count} угод{stats.openCount ? ` · ${stats.openCount} відкритих` : ""}
          </div>
        </div>
        <div className={`text-xl font-semibold ${tone(stats.totalPnl)}`}>{formatMoney(stats.totalPnl, CUR, hidden)}</div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
        <Metric label="Winrate" value={hidden ? "****" : formatPercent(stats.winRate)} />
        <Metric label="ROI" value={hidden ? "****" : formatPercent(stats.roi)} />
        <Metric label="Період" value={formatMoney(stats.totalPnl, CUR, hidden)} className={tone(stats.totalPnl)} />
      </div>
    </Card>
  );
}

export function PolyStatistics({ overview }: { overview: Overview }) {
  const { all, periodStats, period, sections, pool, locks, hidden, reconcile } = overview;
  const activeLocks = locks.filter((lock) => lock.status === "LOCKED");
  const agentNames = Array.from(new Set([...overview.all.byAgent.map((row) => row.name), ...locks.map((lock) => lock.agentName ?? "Без назви")]));
  const equity = periodStats.timeline.map((point) => ({
    date: point.date,
    label: point.label,
    profit: Math.max(0, point.pnl),
    loss: Math.max(0, -point.pnl),
    net: point.net
  }));
  const activeHours = all.byHourUtc.filter((row) => row.count > 0);
  const slippage = all.slippage;

  return (
    <>
      <Card className="mt-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="font-semibold">Результат за період</div>
            <div className={`mt-1 text-sm ${muted}`}>
              {period.label} · вільно в пулі {formatMoney(pool.balance, CUR, hidden)} · заблоковано {formatMoney(pool.lockedPrincipal, CUR, hidden)}
            </div>
          </div>
          <div className="text-right">
            <div className={`text-2xl font-bold ${tone(periodStats.totalPnl)}`}>{formatMoney(periodStats.totalPnl, CUR, hidden)}</div>
            <div className={`text-xs ${muted}`}>PnL · {periodStats.count} закритих</div>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <Metric label="Весь час" value={formatMoney(all.totalPnl, CUR, hidden)} className={tone(all.totalPnl)} />
          <Metric label="У відкритих угодах" value={formatMoney(all.openExposure, CUR, hidden)} />
          <Metric label="Winrate періоду" value={hidden ? "****" : formatPercent(periodStats.winRate)} />
          <Metric label="Profit factor" value={hidden ? "****" : (periodStats.profitFactor == null ? "—" : formatPlain(periodStats.profitFactor))} />
          <Metric label="Оборот / ROI" value={hidden ? "****" : `${formatMoney(periodStats.turnover, CUR, false)} · ${formatPercent(periodStats.roi)}`} />
          <Metric label="Комісії" value={formatMoney(periodStats.fees, CUR, hidden)} />
          <Metric label="Пул зараз" value={formatMoney(pool.total, CUR, hidden)} />
          <Metric label="Відкритих" value={String(all.openCount)} />
        </div>
        {reconcile && !reconcile.ok ? (
          <div className="mt-3 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
            Звірка не сходиться: баланс пулу відрізняється від леджера на {formatMoney(reconcile.balanceDrift, CUR, hidden)}, проведений PnL угод — на{" "}
            {formatMoney(reconcile.pnlDrift, CUR, hidden)}. Перевір ручні правки балансу або видалені рядки.
          </div>
        ) : null}
      </Card>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {(["MANUAL", "COPYTRADE", "AI_AGENT"] as const).map((section) => (
          <SectionCard key={section} section={section} stats={sections[section]} hidden={hidden} />
        ))}
      </div>

      <Card className="mt-4">
        <div className="mb-1 font-semibold">AI-агенти</div>
        <div className={`mb-3 text-sm ${muted}`}>
          Гроші заблоковані на 30 днів. PnL агента в грошах з&apos;являється, коли блокування знято; результат угод нижче — аналітика всередині блокування.
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {Array.from({ length: Math.max(AGENT_SLOTS, agentNames.length) }, (_, index) => {
            const name = agentNames[index];
            if (!name) {
              return (
                <div key={`slot-${index}`} className={`rounded-lg border border-dashed border-border p-4 text-sm ${muted}`}>
                  Агент {index + 1}: ще не підключено
                </div>
              );
            }
            const lock = activeLocks.filter((item) => (item.agentName ?? "Без назви") === name).sort((a, b) => a.unlockAt.localeCompare(b.unlockAt))[0];
            const stats = all.byAgent.find((row) => row.name === name);
            const released = locks.filter((item) => (item.agentName ?? "Без назви") === name && item.resultPnlUsd != null);
            const realized = released.reduce((sum, item) => sum + Number(item.resultPnlUsd), 0);
            return (
              <div key={name} className="rounded-lg bg-muted p-4 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="truncate font-semibold">{name}</div>
                  <div className={`shrink-0 font-semibold ${tone(stats?.pnl ?? "0")}`}>{formatMoney(stats?.pnl ?? "0", CUR, hidden)}</div>
                </div>
                <div className={`mt-1 text-xs ${muted}`}>
                  {stats?.count ?? 0} угод · winrate {hidden ? "****" : formatPercent(stats?.winRate ?? 0)} · аналітичний PnL
                </div>
                {lock ? (
                  <div className="mt-3 rounded-md bg-background/60 p-2">
                    <div>Заблоковано {formatMoney(lock.amountUsd, CUR, hidden)}</div>
                    <div className={`text-xs ${lock.canRelease ? "text-success" : muted}`}>
                      {lock.canRelease ? "Можна виймати" : `ще ${lock.daysLeft} дн.`} · до {new Date(lock.unlockAt).toLocaleDateString("uk-UA", { timeZone: "Europe/Kyiv" })}
                    </div>
                  </div>
                ) : (
                  <div className={`mt-3 text-xs ${muted}`}>Активного блокування немає</div>
                )}
                {released.length ? (
                  <div className="mt-2 text-xs">
                    Знято блокувань: {released.length} · результат <span className={tone(String(realized))}>{formatMoney(realized, CUR, hidden)}</span>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="mt-4">
        <div className="mb-1 font-semibold">PnL по днях · {period.label}</div>
        <div className={`mb-3 text-sm ${muted}`}>Закриті угоди вибраного періоду; зверху результат дня, знизу — накопичений</div>
        <NetPnlChart data={equity} hidden={hidden} currency={CUR} />
      </Card>

      <Card className="mt-4">
        <div className="grid gap-5 md:grid-cols-2">
          <Breakdown title="По типу ринку" rows={all.byMarketKind} hidden={hidden} />
          <Breakdown title="По ціні входу" rows={all.byPriceBucket.filter((row) => row.count > 0)} hidden={hidden} />
          <Breakdown title="По годинах (UTC)" rows={activeHours} hidden={hidden} />
          <Breakdown title="По тижнях" rows={all.byWeek} hidden={hidden} />
          <Breakdown title="По днях" rows={all.byDay.slice(0, 10)} hidden={hidden} />
          <div>
            <div className="mb-2 text-sm font-semibold">Slippage копітрейду</div>
            {slippage.count ? (
              <div className="grid gap-2 text-sm">
                <Metric label="Середня різниця до сигналу" value={hidden ? "****" : `${formatPlain(slippage.avgPoints)} (${formatPercent(slippage.avgPercent)})`} />
                <Metric label="Втрачено на slippage" value={formatMoney(`-${slippage.costUsd}`, CUR, hidden)} className="text-danger" />
                <Metric label="Гірша ціна, ніж у лідера" value={hidden ? "****" : `${slippage.worseCount} з ${slippage.count}`} />
              </div>
            ) : (
              <div className={`rounded-lg border border-dashed border-border p-4 text-center text-sm ${muted}`}>
                Додай signalPrice до копі-угод, щоб бачити проковзування
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card className="mt-4">
        <div className="mb-3 text-sm font-semibold">Усі угоди</div>
        <PolyTradesTable trades={overview.trades} hidden={hidden} />
      </Card>
    </>
  );
}
