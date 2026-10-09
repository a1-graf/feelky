import { NetPnlChart } from "@/components/income-line-chart";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/money";
import type { summarizeFx } from "@/lib/fx-stats";

type FxData = ReturnType<typeof summarizeFx>;
type Broker = { name: string; currency: string; balance: string };
type Row = FxData["byInstrument"][number];

const tone = (value: string) => (Number(value) >= 0 ? "text-success" : "text-danger");

function Metric({ label, value, className = "" }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className="rounded-lg bg-muted p-3">
      <div className="text-xs text-[hsl(var(--card-muted-foreground))]">{label}</div>
      <div className={`mt-1 font-semibold ${className}`}>{value}</div>
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

export function FxStatistics({ data, brokers, hidden = false }: { data: FxData; brokers: Broker[]; hidden?: boolean }) {
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
        </div>
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
