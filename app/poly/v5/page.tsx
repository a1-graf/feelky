import { BreakdownBars } from "@/components/breakdown-bars";
import { PageTitle } from "@/components/page-title";
import { Card } from "@/components/ui/card";
import { PolyVariantNav } from "@/components/poly-variants/variant-nav";
import { CUR, Empty, Metric, kyivDate, muted, plural, tone } from "@/components/poly-variants/ui";
import { D, formatMoney, formatPercent, formatSigned } from "@/lib/money";
import { getPolyVariantsData, polyGroupBy, POLY_WALLET_ADDRESSES } from "@/lib/poly-variants";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

const FLOW_LABELS = { deposit: "Поповнення", withdraw: "Виведення", adjustment: "Розрахунки без угоди" } as const;
const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;

/** Variant 5: money by wallet and account — what went in, what is there now, and how each wallet did. */
export default async function PolyV5Page() {
  const userId = await requireUserId();
  const { overview, money, flows } = await getPolyVariantsData(userId);
  const { hidden, locks } = overview;
  const wallets = polyGroupBy(overview.trades.filter((trade) => trade.section !== "AI_AGENT"), (trade) => trade.walletRef ?? "Без гаманця");
  const openByWallet = new Map<string, string>();
  for (const trade of overview.trades) {
    if (trade.status !== "OPEN") continue;
    const key = trade.walletRef ?? "Без гаманця";
    openByWallet.set(key, D(openByWallet.get(key) ?? 0).plus(trade.sizeUsd).toString());
  }
  const agents = locks.filter((lock) => lock.status === "LOCKED");
  const steps = [
    { label: "Внесено", value: money.deposited, signed: false },
    { label: "Виведено", value: D(money.withdrawn).negated().toString(), signed: true },
    { label: "Результат угод з гаманців", value: money.tradesPnl, signed: true },
    { label: "Розрахунки без рядка угоди", value: money.unattributed, signed: true },
    ...(D(overview.releasedResult).isZero() ? [] : [{ label: "Результат знятих блокувань агентів", value: overview.releasedResult, signed: true }])
  ];
  const computed = D(money.deposited).minus(money.withdrawn).plus(money.tradesPnl).plus(money.unattributed).plus(overview.releasedResult);
  const drift = D(money.now).minus(computed);
  const max = Math.max(Number(money.deposited), Number(money.now), 1);

  return (
    <>
      <PageTitle title="Polymarket" subtitle="Варіант 5 · гаманці та рахунки: внесено проти того, що є зараз" />
      <PolyVariantNav current="/poly/v5" />

      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { label: "Внесено мінус виведено", value: money.netIn, bar: "bg-muted-foreground/40" },
            { label: "Зараз на Polymarket", value: money.now, bar: D(money.change).lt(0) ? "bg-danger" : "bg-success" }
          ].map((item) => (
            <div key={item.label}>
              <div className={`text-xs ${muted}`}>{item.label}</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{formatMoney(item.value, CUR, hidden)}</div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                <div className={`h-full rounded-full ${item.bar}`} style={{ width: `${Math.max(2, (Number(item.value) / max) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div className={`mt-3 text-sm ${tone(money.change)}`}>
          {hidden ? "••••" : `${formatSigned(money.change)} ${CUR} (${formatSigned(money.changePct)}%) до внесеного`}
          <span className={`ml-1 text-xs ${muted}`}>· вклад в агенті рахується за сумою вкладу, його результат ще невідомий</span>
        </div>

        <div className="mt-4 border-t border-border pt-3 text-sm">
          <div className="mb-2 font-semibold">Звідки така сума</div>
          {steps.map((step) => (
            <div key={step.label} className="flex justify-between gap-2 py-1">
              <span className={muted}>{step.label}</span>
              <span className={`tabular-nums ${step.signed ? tone(step.value) : ""}`}>{hidden ? "••••" : `${step.signed ? formatSigned(step.value) : formatMoney(step.value, CUR)}${step.signed ? ` ${CUR}` : ""}`}</span>
            </div>
          ))}
          <div className="flex justify-between gap-2 border-t border-border py-1 font-semibold">
            <span>Разом зараз</span>
            <span className="tabular-nums">{formatMoney(computed.toString(), CUR, hidden)}</span>
          </div>
          <div className={`text-xs ${drift.isZero() ? "text-success" : "text-danger"}`}>
            {drift.isZero()
              ? `Сходиться з балансом: вільно ${formatMoney(money.free, CUR, hidden)} + вклад в агенті ${formatMoney(money.locked, CUR, hidden)}`
              : `Не сходиться з балансом на ${formatMoney(drift.toString(), CUR, hidden)}`}
          </div>
        </div>
      </Card>

      <Card className="mt-4">
        <div className="mb-3 font-semibold">Порівняння гаманців за результатом угод</div>
        {wallets.length ? <BreakdownBars items={wallets.map((wallet) => ({ name: wallet.name, value: Number(wallet.pnl) }))} hidden={hidden} /> : <Empty>Поки немає закритих угод</Empty>}
      </Card>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {wallets.map((wallet) => {
          const address = POLY_WALLET_ADDRESSES[wallet.name];
          return (
            <Card key={wallet.name}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">Акаунт {wallet.name}</div>
                  {address ? (
                    <a className={`text-xs underline-offset-2 hover:underline ${muted}`} href={`https://polymarket.com/profile/${address}`} target="_blank" rel="noreferrer">
                      {shortAddress(address)}
                    </a>
                  ) : null}
                </div>
                <div className={`text-xl font-semibold tabular-nums ${tone(wallet.pnl)}`}>{hidden ? "••••" : `${formatSigned(wallet.pnl)} ${CUR}`}</div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <Metric label="Угод" value={String(wallet.count)} hint={`${wallet.wins} виграшних / ${wallet.losses} програшних`} />
                <Metric label="Частка виграшних" value={formatPercent(wallet.winShare, hidden)} />
                <Metric label="Поставлено разом" value={formatMoney(wallet.turnover, CUR, hidden)} />
                <Metric label="Прибутковість на ставку" value={formatPercent(wallet.yieldPct, hidden)} className={tone(wallet.yieldPct)} />
                <Metric label="Зараз у відкритих угодах" value={formatMoney(openByWallet.get(wallet.name) ?? "0", CUR, hidden)} />
                <Metric label="Середня ставка" value={formatMoney(wallet.avgStake, CUR, hidden)} />
              </div>
            </Card>
          );
        })}
        {agents.map((lock) => (
          <Card key={lock.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold">{lock.agentName ?? "AI-агент"}</div>
                <div className={`text-xs ${muted}`}>AI-агент · гроші заблоковано</div>
              </div>
              <div className="text-xl font-semibold tabular-nums">{formatMoney(lock.amountUsd, CUR, hidden)}</div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <Metric label="Вкладено" value={kyivDate(lock.lockedAt)} />
              <Metric label="Розблокування" value={kyivDate(lock.unlockAt)} hint={lock.canRelease ? "можна забирати" : `ще ${lock.daysLeft} ${plural(lock.daysLeft, "день", "дні", "днів")}`} />
              <Metric label="Результат" value="стане відомим після зняття" />
              <Metric label="Частка банку" value={formatPercent(D(money.now).gt(0) ? D(lock.amountUsd).div(money.now).times(100).toString() : "0", hidden)} />
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-4">
        <div className="mb-3 font-semibold">Рух грошей</div>
        {flows.length ? (
          <ul className="text-sm">
            {flows.map((flow) => {
              const value = flow.kind === "withdraw" ? D(flow.amount).negated().toString() : flow.amount;
              return (
                <li key={flow.id} className="flex items-start justify-between gap-3 border-b border-border/50 py-2 last:border-0">
                  <div className="min-w-0">
                    <div>
                      {FLOW_LABELS[flow.kind]} <span className={`text-xs ${muted}`}>· {kyivDate(flow.date, true)}</span>
                    </div>
                    {flow.note ? <div className={`truncate text-xs ${muted}`}>{flow.note}</div> : null}
                  </div>
                  <div className={`shrink-0 font-semibold tabular-nums ${tone(value)}`}>{hidden ? "••••" : formatSigned(value)}</div>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty>Поповнень і виведень ще не було</Empty>
        )}
      </Card>
    </>
  );
}
