import { BreakdownBars } from "@/components/breakdown-bars";
import { PageTitle } from "@/components/page-title";
import { Card } from "@/components/ui/card";
import { PolyVariantNav } from "@/components/poly-variants/variant-nav";
import { CUR, Empty, Metric, kyivDate, muted, plural, tone } from "@/components/poly-variants/ui";
import { formatMoney, formatPercent, formatSigned } from "@/lib/money";
import { POLY_SECTION_LABELS } from "@/lib/poly-stats";
import { getPolyVariantsData, polyGroupBy, polyTradeSource } from "@/lib/poly-variants";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

const SOURCE_HINTS: Record<string, string> = {
  "Бот poly-flipper": "Наш бот повторює угоди лідера з гаманця 1",
  "Копіювання в Polyvsn": "Вбудоване копіювання сервісу Polyvsn",
  Вручну: "Угоди, відкриті руками на сайті Polymarket",
  Копітрейд: "Копіювання без уточненого джерела"
};

/** Variant 2: who made the money — every source of trades side by side, plus the AI agent and real versus paper. */
export default async function PolyV2Page() {
  const userId = await requireUserId();
  const { overview } = await getPolyVariantsData(userId);
  const { hidden, locks } = overview;
  // Whole history: the overview's own section split follows the default period filter.
  const sections = new Map(polyGroupBy(overview.trades, (trade) => trade.section).map((row) => [row.name, row]));
  const sources = polyGroupBy(overview.trades, polyTradeSource);
  const openBySource = new Map<string, number>();
  for (const trade of overview.trades) if (trade.status === "OPEN") openBySource.set(polyTradeSource(trade), (openBySource.get(polyTradeSource(trade)) ?? 0) + 1);
  const agentLocks = locks.filter((lock) => lock.status === "LOCKED");
  const released = locks.filter((lock) => lock.resultPnlUsd != null);

  return (
    <>
      <PageTitle title="Polymarket" subtitle="Варіант 2 · по джерелах: хто заробляє, а хто зливає" />
      <PolyVariantNav current="/poly/v2" />

      <Card>
        <div className="mb-3 font-semibold">Порівняння джерел</div>
        {sources.length ? (
          <BreakdownBars items={sources.map((source) => ({ name: `${source.name} · ${source.count} ${plural(source.count, "угода", "угоди", "угод")}`, value: Number(source.pnl) }))} hidden={hidden} />
        ) : (
          <Empty>Поки немає закритих угод</Empty>
        )}
      </Card>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {sources.map((source) => (
          <Card key={source.name}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold">{source.name}</div>
                <div className={`mt-1 text-xs ${muted}`}>{SOURCE_HINTS[source.name] ?? "AI-агент"}</div>
              </div>
              <div className={`text-xl font-semibold tabular-nums ${tone(source.pnl)}`}>{hidden ? "••••" : `${formatSigned(source.pnl)} ${CUR}`}</div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <Metric label="Угод" value={`${source.count}${openBySource.get(source.name) ? ` + ${openBySource.get(source.name)} відкритих` : ""}`} hint={`${source.wins} виграшних / ${source.losses} програшних`} />
              <Metric label="Частка виграшних" value={formatPercent(source.winShare, hidden)} />
              <Metric label="Прибутковість на ставку" value={formatPercent(source.yieldPct, hidden)} className={tone(source.yieldPct)} />
              <Metric label="Середня ставка" value={formatMoney(source.avgStake, CUR, hidden)} />
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-4">
        <div className="mb-3 font-semibold">Розділи</div>
        <div className="grid gap-3 sm:grid-cols-3">
          {(["MANUAL", "COPYTRADE", "AI_AGENT"] as const).map((key) => {
            const row = sections.get(key);
            const pnl = row?.pnl ?? "0";
            const count = row?.count ?? 0;
            return (
              <Metric
                key={key}
                label={POLY_SECTION_LABELS[key]}
                value={hidden ? "••••" : `${formatSigned(pnl)} ${CUR}`}
                className={tone(pnl)}
                hint={`${count} ${plural(count, "закрита угода", "закриті угоди", "закритих угод")}${row ? ` · частка виграшних ${formatPercent(row.winShare, hidden)}` : ""}`}
              />
            );
          })}
        </div>
      </Card>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card>
          <div className="mb-1 font-semibold">AI-агенти</div>
          <div className={`mb-3 text-xs ${muted}`}>Вклад заблоковано; результат стане відомим, коли блокування знімуть.</div>
          {agentLocks.length ? (
            <div className="grid gap-2">
              {agentLocks.map((lock) => (
                <div key={lock.id} className="rounded-lg bg-muted p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{lock.agentName ?? "Без назви"}</span>
                    <span className="font-semibold tabular-nums">{formatMoney(lock.amountUsd, CUR, hidden)}</span>
                  </div>
                  <div className={`mt-1 text-xs ${lock.canRelease ? "text-success" : muted}`}>
                    {lock.canRelease ? "Можна забирати" : `ще ${lock.daysLeft} ${plural(lock.daysLeft, "день", "дні", "днів")}`} · розблокування {kyivDate(lock.unlockAt)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty>Активних блокувань немає</Empty>
          )}
          {released.length ? (
            <div className={`mt-2 text-xs ${muted}`}>Знятих блокувань: {released.length}</div>
          ) : null}
        </Card>

        <Card>
          <div className="mb-1 font-semibold">Реальні гроші чи тренування</div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <Metric label="На реальні гроші" value={`${overview.trades.length} ${plural(overview.trades.length, "угода", "угоди", "угод")}`} hint={hidden ? undefined : `${formatSigned(overview.all.totalPnl)} ${CUR}`} />
            <Metric label="Тренувальні (paper)" value="0 угод" hint="у Feelky не заносяться" />
          </div>
          <div className={`mt-3 text-xs ${muted}`}>Тренувальні стратегії живуть у ботах на сервері; сюди потрапляють лише угоди з реальних гаманців.</div>
        </Card>
      </div>
    </>
  );
}
