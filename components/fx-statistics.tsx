import { FxBalanceChart } from "@/components/fx-balance-chart";
import { NetPnlChart } from "@/components/income-line-chart";
import { FxPositions } from "@/components/fx-positions";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/money";
import type { FxBalancePoint, summarizeFx, summarizeFxFlows } from "@/lib/fx-stats";

type FxData = ReturnType<typeof summarizeFx>;
type Broker = { name: string; currency: string; balance: string };
type Flows = ReturnType<typeof summarizeFxFlows>;
type Row = FxData["byInstrument"][number];
type Period = FxData["allTime"];

const tone = (value: string) => (Number(value) >= 0 ? "text-success" : "text-danger");
const signed = (value: string) => (Number(value) > 0 ? `+${value}` : value);
const signedMoney = (value: string, currency: string, hidden: boolean) => `${Number(value) > 0 && !hidden ? "+" : ""}${formatMoney(value, currency, hidden)}`;
const formatR = (r: string | null, hidden: boolean) => (hidden ? "****" : r == null ? "—" : `${signed(r)}R`);
const formatDate = (iso: string) => new Date(iso).toLocaleString("uk-UA", { timeZone: "Europe/Kyiv", dateStyle: "short", timeStyle: "short" });
const formatMonth = (key: string) => {
  if (key === "all") return "Весь час";
  const [year, month] = key.split("-").map(Number);
  const name = new Date(Date.UTC(year, month - 1, 15)).toLocaleString("uk-UA", { month: "long", timeZone: "UTC" });
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${year}`;
};

const th = "px-1.5 py-2 sm:px-2 text-xs font-normal text-[hsl(var(--card-muted-foreground))]";
const td = "px-1.5 py-2.5 whitespace-nowrap sm:px-2";

function PeriodRow({ period, currency, hidden, total = false, current = false }: { period: Period; currency: string; hidden: boolean; total?: boolean; current?: boolean }) {
  return (
    <tr className={total ? "border-t-4 border-t-border bg-primary/10 font-semibold" : "border-t border-border/60"}>
      <td className={`${td} relative pl-5 sm:pl-6 ${total ? "border-l-4 border-l-primary" : ""}`}>{current && <span aria-label="Поточний місяць" title="Поточний місяць" className="absolute left-2 top-1/2 sm:left-2.5 h-2 w-2 -translate-y-1/2 animate-pulse rounded-full bg-success" />}{formatMonth(period.key)}</td>
      <td className={`${td} text-center`}>{period.count}</td>
      <td className={`${td} text-center`}>{hidden ? "****" : `${period.winRate}%`}</td>
      <td className={`${td} text-center ${tone(period.pnl)}`}>{formatMoney(period.pnl, currency, hidden)}</td>
    </tr>
  );
}

function PeriodTable({ months, allTime, currency, hidden, currentMonthKey }: { months: Period[]; allTime: Period; currency: string; hidden: boolean; currentMonthKey: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-0 text-[13px] sm:text-sm">
        <thead>
          <tr className="text-left">
            <th className={`${th} pl-5 sm:pl-6`}>Період</th>
            <th className={`${th} text-center`}>Угод</th>
            <th className={`${th} text-center`}>Winrate</th>
            <th className={`${th} text-center`}>Результат</th>
          </tr>
        </thead>
        <tbody>
          {months.map((period) => (
            <PeriodRow key={period.key} period={period} currency={currency} hidden={hidden} current={period.key === currentMonthKey} />
          ))}
        </tbody>
        <tbody aria-hidden>
          <tr><td colSpan={4} className="h-3 p-0" /></tr>
        </tbody>
        <tbody>
          <PeriodRow period={allTime} currency={currency} hidden={hidden} total />
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

function SplitTile({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 items-center rounded-lg bg-muted py-3.5 lg:grid-cols-2">{children}</div>;
}

function Half({ label, main, sub, className = "", divider = false }: { label: string; main: React.ReactNode; sub?: string; className?: string; divider?: boolean }) {
  return (
    <div className={`min-w-0 px-2 text-center ${divider ? "mt-3 border-t-2 border-foreground/70 pt-3 lg:mt-0 lg:self-stretch lg:border-l-2 lg:border-t-0 lg:pt-0" : "lg:pb-0"}`}>
      <div className="text-sm text-[hsl(var(--card-muted-foreground))]">{label}</div>
      <div className={`mt-1.5 whitespace-nowrap font-bold tabular-nums ${className}`}>
        <div className="text-xl sm:text-2xl xl:text-3xl">{main}</div>
        {sub && <div className="mt-0.5 text-lg">{sub}</div>}
      </div>
    </div>
  );
}

export function FxStatistics({ data, brokers, flows, balanceSeries, hidden = false }: { data: FxData; brokers: Broker[]; flows: Flows; balanceSeries: FxBalancePoint[]; hidden?: boolean }) {
  const currency = brokers[0]?.currency || "USD";

  return (
    <>
      <Card className="mt-0 md:mt-4">
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          <div className="flex items-center justify-center rounded-lg bg-muted px-3 py-3.5 text-center">
            <div className="font-bold tabular-nums text-xl sm:text-2xl xl:text-3xl">
              {brokers.length ? brokers.map((broker) => formatMoney(broker.balance, broker.currency, hidden)).join(" · ") : <span className="text-base font-normal text-[hsl(var(--card-muted-foreground))]">Рахунок брокера ще не створено</span>}
            </div>
          </div>
          <SplitTile>
            <Half label="За місяць" className={tone(data.monthPnl)} main={signedMoney(data.monthPnl, currency, hidden)} sub={formatR(data.monthSumR, hidden)} />
            <Half label="Total profit" className={tone(data.totalPnl)} main={signedMoney(data.totalPnl, currency, hidden)} sub={formatR(data.allTime.sumR, hidden)} divider />
          </SplitTile>
          <FxBalanceChart data={balanceSeries} currency={currency} hidden={hidden} />
          <SplitTile>
            <Half label="Плюсових / мінусових" main={hidden ? "****" : <><span className="text-success">{data.wins}</span> / <span className="text-danger">{data.losses}</span></>} />
            <Half label="Winrate" main={hidden ? "****" : `${data.winRate}%`} divider />
          </SplitTile>
        </div>
      </Card>

      <Card className="mt-4">
        <div className="mb-1 font-semibold">Місяці та весь час</div>
        <div className="mb-3 text-sm text-[hsl(var(--card-muted-foreground))]">
          1R = {data.oneRUsd} {currency} (1%)
        </div>
        {data.count ? (
          <PeriodTable months={data.byMonth} allTime={data.allTime} currency={currency} hidden={hidden} currentMonthKey={data.currentMonthKey} />
        ) : (
          <div className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-[hsl(var(--card-muted-foreground))]">Поки немає угод.</div>
        )}
      </Card>

      <FxPositions trades={data.trades} currency={currency} hidden={hidden} />

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
        <div className="mb-3 font-semibold">PnL по днях (накопичений)</div>
        <NetPnlChart data={data.timeline} hidden={hidden} currency={currency} cumulativeOnly />
      </Card>

      <Card className="mt-4">
        <div className="grid gap-5 md:grid-cols-2">
          <Breakdown title="По інструментах" rows={data.byInstrument} currency={currency} hidden={hidden} />
          <Breakdown title="По сетапах" rows={data.bySetup} currency={currency} hidden={hidden} />
        </div>
      </Card>
    </>
  );
}
