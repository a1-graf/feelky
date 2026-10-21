import { NetPnlChart } from "@/components/income-line-chart";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/money";
import type { summarizeFx, summarizeFxFlows } from "@/lib/fx-stats";

type FxData = ReturnType<typeof summarizeFx>;
type Broker = { name: string; currency: string; balance: string };
type Flows = ReturnType<typeof summarizeFxFlows>;
type Row = FxData["byInstrument"][number];
type Period = FxData["allTime"];

const tone = (value: string) => (Number(value) >= 0 ? "text-success" : "text-danger");
const signed = (value: string) => (Number(value) > 0 ? `+${value}` : value);
const formatR = (r: string | null, hidden: boolean) => (hidden ? "****" : r == null ? "—" : `${signed(r)}R`);
const formatDate = (iso: string) => new Date(iso).toLocaleString("uk-UA", { timeZone: "Europe/Kyiv", dateStyle: "short", timeStyle: "short" });
const formatMonth = (key: string) => {
  if (key === "all") return "Весь час";
  const [year, month] = key.split("-").map(Number);
  const name = new Date(Date.UTC(year, month - 1, 15)).toLocaleString("uk-UA", { month: "long", timeZone: "UTC" });
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${year}`;
};

const th = "px-2 py-2 text-xs font-normal text-[hsl(var(--card-muted-foreground))]";
const td = "px-2 py-2.5 whitespace-nowrap";

function Metric({ label, value, className = "" }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className="rounded-lg bg-muted p-3">
      <div className="text-xs text-[hsl(var(--card-muted-foreground))]">{label}</div>
      <div className={`mt-1 font-semibold ${className}`}>{value}</div>
    </div>
  );
}

function PeriodTable({ periods, currency, hidden }: { periods: Period[]; currency: string; hidden: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="text-left">
            <th className={th}>Період</th>
            <th className={`${th} text-right`}>Угод</th>
            <th className={`${th} text-right`}>Winrate</th>
            <th className={`${th} text-right`}>Сума R</th>
            <th className={`${th} text-right`}>Серед. R</th>
            <th className={`${th} text-right`}>Результат</th>
            <th className={`${th} text-right`}>Краща</th>
            <th className={`${th} text-right`}>Гірша</th>
          </tr>
        </thead>
        <tbody>
          {periods.map((period) => {
            const total = period.key === "all";
            return (
              <tr key={period.key} className={`border-t border-border/60 ${total ? "bg-muted font-semibold" : ""}`}>
                <td className={td}>{formatMonth(period.key)}</td>
                <td className={`${td} text-right`}>{period.count}</td>
                <td className={`${td} text-right`}>{hidden ? "****" : `${period.winRate}%`}</td>
                <td className={`${td} text-right ${tone(period.sumR)}`}>
                  {formatR(period.sumR, hidden)}
                </td>
                <td className={`${td} text-right ${tone(period.avgR)}`}>{formatR(period.avgR, hidden)}</td>
                <td className={`${td} text-right ${tone(period.pnl)}`}>{formatMoney(period.pnl, currency, hidden)}</td>
                <td className={`${td} text-right text-success`}>
                  {period.best ? `${formatMoney(period.best.pnl, currency, hidden)}${period.best.r ? ` · ${formatR(period.best.r, hidden)}` : ""}` : "—"}
                </td>
                <td className={`${td} text-right text-danger`}>
                  {period.worst ? `${formatMoney(period.worst.pnl, currency, hidden)}${period.worst.r ? ` · ${formatR(period.worst.r, hidden)}` : ""}` : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PositionsTable({ trades, currency, hidden }: { trades: FxData["trades"]; currency: string; hidden: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="text-left">
            <th className={th}>Закрито</th>
            <th className={th}>Інструмент</th>
            <th className={th}>Сторона</th>
            <th className={`${th} text-right`}>Лот</th>
            <th className={`${th} text-right`}>Вхід → вихід</th>
            <th className={`${th} text-right`}>R</th>
            <th className={`${th} text-right`}>Ризик, R</th>
            <th className={`${th} text-right`}>R від свого ризику</th>
            <th className={`${th} text-right`}>$</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((trade) => (
            <tr key={trade.id} className="border-t border-border/60" title={trade.note ?? undefined}>
              <td className={`${td} text-[hsl(var(--card-muted-foreground))]`}>{formatDate(trade.closedAt)}</td>
              <td className={`${td} font-medium`}>{trade.instrument}</td>
              <td className={td}>
                <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium">{trade.side === "BUY" ? "BUY" : "SELL"}</span>
              </td>
              <td className={`${td} text-right`}>{trade.lots ?? "—"}</td>
              <td className={`${td} text-right text-[hsl(var(--card-muted-foreground))]`}>
                {trade.openPrice && trade.closePrice ? `${trade.openPrice} → ${trade.closePrice}` : "—"}
              </td>
              <td className={`${td} text-right font-semibold ${trade.r == null ? "" : tone(trade.r)}`}>{formatR(trade.r, hidden)}</td>
              <td className={`${td} text-right text-[hsl(var(--card-muted-foreground))]`}>{hidden ? "****" : trade.riskR == null ? "—" : `${trade.riskR}R`}</td>
              <td className={`${td} text-right text-[hsl(var(--card-muted-foreground))]`}>{formatR(trade.ownR, hidden)}</td>
              <td className={`${td} text-right font-semibold ${tone(trade.pnl)}`}>{formatMoney(trade.pnl, currency, hidden)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Breakdown({ title, rows, currency, hidden }: { title: string; rows: Row[]; currency: string; hidden: boolean }) {
  return (
    <div>
      <div className="mb-2 text-sm font-semibold">{title}</div>
      {rows.length ? (
        <div className="grid gap-2">
          {rows.map((row) => (
            <div key={row.name} className="flex items-center justify-between gap-3 rounded-lg bg-muted p-3 text-sm">
              <div className="min-w-0">
                <div className="truncate font-medium">{row.name}</div>
                <div className="text-xs text-[hsl(var(--card-muted-foreground))]">
                  {row.count} угод · winrate {hidden ? "****" : `${row.winRate}%`}
                </div>
              </div>
              <div className={`shrink-0 font-semibold ${tone(row.pnl)}`}>{formatMoney(row.pnl, currency, hidden)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-[hsl(var(--card-muted-foreground))]">Поки порожньо</div>
      )}
    </div>
  );
}

export function FxStatistics({ data, brokers, flows, hidden = false }: { data: FxData; brokers: Broker[]; flows: Flows; hidden?: boolean }) {
  const currency = brokers[0]?.currency || "USD";

  return (
    <>
      <Card className="mt-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="font-semibold">FX</div>
            <div className="mt-1 text-sm text-[hsl(var(--card-muted-foreground))]">
              {brokers.length
                ? brokers.map((broker) => `${broker.name}: ${formatMoney(broker.balance, broker.currency, hidden)}`).join(" · ")
                : "Рахунок брокера ще не створено"}
            </div>
          </div>
          <div className="text-right">
            <div className={`text-xl font-semibold ${tone(data.totalPnl)}`}>{formatMoney(data.totalPnl, currency, hidden)}</div>
            <div className="text-xs text-[hsl(var(--card-muted-foreground))]">загальний PnL · {data.count} угод</div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <Metric label="PnL місяця" value={formatMoney(data.monthPnl, currency, hidden)} className={tone(data.monthPnl)} />
          <Metric label="Winrate" value={hidden ? "****" : `${data.winRate}%`} />
          <Metric label="Profit factor" value={hidden ? "****" : data.profitFactor ?? "—"} />
          <Metric label="Плюсових / мінусових" value={hidden ? "****" : <><span className="text-success">{data.wins}</span> / <span className="text-danger">{data.losses}</span></>} />
          <Metric label="Середній плюс" value={formatMoney(data.avgWin, currency, hidden)} className="text-success" />
          <Metric label="Середній мінус" value={formatMoney(`-${data.avgLoss}`, currency, hidden)} className="text-danger" />
          <Metric label="Комісії" value={formatMoney(data.commission, currency, hidden)} />
          <Metric label="Своп" value={formatMoney(data.swap, currency, hidden)} />
          <Metric label="Сума R (весь час)" value={formatR(data.allTime.sumR, hidden)} className={tone(data.allTime.sumR)} />
          <Metric label="Внесено" value={formatMoney(flows.deposited, currency, hidden)} />
          <Metric label="Виведено" value={formatMoney(flows.withdrawn, currency, hidden)} />
          <Metric label="Чистий внесок" value={formatMoney(flows.net, currency, hidden)} />
        </div>
      </Card>

      <Card className="mt-4">
        <div className="mb-1 font-semibold">Місяці та весь час</div>
        <div className="mb-3 text-sm text-[hsl(var(--card-muted-foreground))]">
          1R — фіксована сума {data.oneRUsd} {currency} (плановий ризик 1% депозиту). R угоди = $ / 1R, тож сума R узгоджується з доларами.
        </div>
        {data.count ? (
          <PeriodTable periods={[...data.byMonth, data.allTime]} currency={currency} hidden={hidden} />
        ) : (
          <div className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-[hsl(var(--card-muted-foreground))]">Поки немає угод.</div>
        )}
      </Card>

      <Card className="mt-4">
        <div className="mb-1 font-semibold">Усі позиції</div>
        <div className="mb-3 text-sm text-[hsl(var(--card-muted-foreground))]">
          Від найновішої. $ — чистий результат після комісії та свопу; час за Києвом. «Ризик, R» — початковий ризик угоди у фіксованих R (ризик у $ / 1R); «R від свого ризику» — $ / ризик цієї угоди (стара метрика).
        </div>
        {data.trades.length ? (
          <PositionsTable trades={data.trades} currency={currency} hidden={hidden} />
        ) : (
          <div className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-[hsl(var(--card-muted-foreground))]">Поки немає угод.</div>
        )}
      </Card>

      <Card className="mt-4">
        <div className="mb-2 text-sm font-semibold">Депозити та виведення</div>
        {flows.items.length ? (
          <div className="grid gap-2">
            {flows.items.map((flow) => (
              <div key={flow.id} className="flex items-center justify-between gap-3 rounded-lg bg-muted p-3 text-sm">
                <div className="min-w-0">
                  <div className="font-medium">{flow.direction === "deposit" ? "Поповнення" : "Виведення"}</div>
                  <div className="text-xs text-[hsl(var(--card-muted-foreground))]">{formatDate(flow.date)}</div>
                </div>
                <div className={`shrink-0 font-semibold ${flow.direction === "deposit" ? "text-success" : "text-danger"}`}>
                  {formatMoney(flow.direction === "deposit" ? flow.amount : `-${flow.amount}`, currency, hidden)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-[hsl(var(--card-muted-foreground))]">Поповнень ще не внесено</div>
        )}
      </Card>

      <Card className="mt-4">
        <div className="mb-1 font-semibold">PnL по днях</div>
        <div className="mb-3 text-sm text-[hsl(var(--card-muted-foreground))]">Зверху результат кожного дня, знизу — як він накопичувався</div>
        <NetPnlChart data={data.timeline} hidden={hidden} currency={currency} />
      </Card>

      <Card className="mt-4">
        <div className="grid gap-5 md:grid-cols-2">
          <Breakdown title="По інструментах" rows={data.byInstrument} currency={currency} hidden={hidden} />
          <Breakdown title="По сетапах" rows={data.bySetup} currency={currency} hidden={hidden} />
        </div>
      </Card>

      <Card className="mt-4">
        <div className="mb-2 text-sm font-semibold">Останні угоди</div>
        {data.recent.length ? (
          <div className="grid gap-2">
            {data.recent.map((trade) => (
              <div key={trade.id} className="rounded-lg bg-muted p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium">
                      {trade.instrument} <span className="text-xs text-[hsl(var(--card-muted-foreground))]">{trade.side === "BUY" ? "купівля" : "продаж"}{trade.lots ? ` · ${trade.lots} лот` : ""}</span>
                    </div>
                    <div className="text-xs text-[hsl(var(--card-muted-foreground))]">
                      {new Date(trade.closedAt).toLocaleString("uk-UA", { timeZone: "Europe/Kyiv", dateStyle: "short", timeStyle: "short" })}
                      {trade.setup ? ` · ${trade.setup}` : ""}
                    </div>
                  </div>
                  <div className={`shrink-0 font-semibold ${tone(trade.pnl)}`}>{formatMoney(trade.pnl, currency, hidden)}</div>
                </div>
                {trade.note ? <div className="mt-2 text-xs text-[hsl(var(--card-muted-foreground))]">{trade.note}</div> : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-[hsl(var(--card-muted-foreground))]">
            Поки немає угод. Їх заносить OpenClaw.
          </div>
        )}
      </Card>
    </>
  );
}
