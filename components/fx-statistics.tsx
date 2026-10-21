import { ChevronDown } from "lucide-react";
import { NetPnlChart } from "@/components/income-line-chart";
import { FxPositions } from "@/components/fx-positions";
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
const td = "px-2 py-2.5 whitespace-nowrap tabular-nums";
const muted = "text-[hsl(var(--card-muted-foreground))]";
const empty = "rounded-lg border border-dashed border-border p-4 text-center text-sm text-[hsl(var(--card-muted-foreground))]";

const amountOnly = (value: string, currency: string, hidden: boolean) => formatMoney(value, currency, hidden).replace(new RegExp(` ${currency}$`), "");
const extremeText = (extreme: Period["best"], currency: string, hidden: boolean) =>
  extreme ? `${formatMoney(extreme.pnl, currency, hidden)}${extreme.r ? ` · ${formatR(extreme.r, hidden)}` : ""}` : "—";

function Metric({ label, value, className = "" }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-muted p-3">
      <div className={`text-[10px] sm:text-xs ${muted}`}>{label}</div>
      <div className={`mt-1 whitespace-nowrap text-xl font-semibold tabular-nums sm:text-2xl ${className}`}>{value}</div>
    </div>
  );
}

function ProfitHalf({ label, money, r, value, currency, hidden }: { label: string; money: string; r: string; value: string; currency: string; hidden: boolean }) {
  return (
    <div className="min-w-0 px-1.5 first:pl-0 last:pr-0 sm:px-2">
      <div className={`text-[10px] sm:text-xs ${muted}`}>{label}</div>
      <div className={`text-[10px] sm:text-xs ${muted}`}>{hidden ? "\u00a0" : currency}</div>
      <div className={`mt-1 font-semibold tabular-nums ${tone(value)}`}>
        <div className="whitespace-nowrap text-lg sm:text-2xl">{money}</div>
        <div className="whitespace-nowrap text-xs sm:text-sm">{r}</div>
      </div>
    </div>
  );
}

function PeriodRow({ period, currency, hidden, total = false }: { period: Period; currency: string; hidden: boolean; total?: boolean }) {
  return (
    <tr className={total ? "border-t-2 border-primary/40 bg-muted font-semibold" : "border-t border-border/60"}>
      <th scope="row" className={`${td} text-left font-[inherit]`}>{formatMonth(period.key)}</th>
      <td className={`${td} text-right`}>{period.count}</td>
      <td className={`${td} text-right`}>{hidden ? "****" : `${period.winRate}%`}</td>
      <td className={`${td} text-right ${tone(period.sumR)}`}>{formatR(period.sumR, hidden)}</td>
      <td className={`${td} text-right ${tone(period.avgR)}`}>{formatR(period.avgR, hidden)}</td>
      <td className={`${td} text-right ${tone(period.pnl)}`}>{formatMoney(period.pnl, currency, hidden)}</td>
      <td className={`${td} text-right text-success`}>{extremeText(period.best, currency, hidden)}</td>
      <td className={`${td} text-right text-danger`}>{extremeText(period.worst, currency, hidden)}</td>
    </tr>
  );
}

function PeriodTable({ months, allTime, currency, hidden }: { months: Period[]; allTime: Period; currency: string; hidden: boolean }) {
  return (
    <div className="hidden overflow-x-auto md:block">
      <table className="w-full min-w-[720px] text-sm">
        <caption className="sr-only">Статистика по місяцях і за весь час</caption>
        <thead>
          <tr className="text-left">
            <th scope="col" className={th}>Період</th>
            <th scope="col" className={`${th} text-right`}>Угод</th>
            <th scope="col" className={`${th} text-right`}>Winrate</th>
            <th scope="col" className={`${th} text-right`}>Сума R</th>
            <th scope="col" className={`${th} text-right`}>Серед. R</th>
            <th scope="col" className={`${th} text-right`}>Результат</th>
            <th scope="col" className={`${th} text-right`}>Краща</th>
            <th scope="col" className={`${th} text-right`}>Гірша</th>
          </tr>
        </thead>
        <tbody>
          {months.map((period) => (
            <PeriodRow key={period.key} period={period} currency={currency} hidden={hidden} />
          ))}
        </tbody>
        <tbody aria-hidden>
          <tr><td colSpan={8} className="h-3 p-0" /></tr>
        </tbody>
        <tbody>
          <PeriodRow period={allTime} currency={currency} hidden={hidden} total />
        </tbody>
      </table>
    </div>
  );
}

function PeriodCard({ period, currency, hidden, total = false }: { period: Period; currency: string; hidden: boolean; total?: boolean }) {
  return (
    <li className={`rounded-lg px-3 pt-3 ${total ? "bg-muted" : "border border-border/60"}`}>
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0 truncate font-semibold">{formatMonth(period.key)}</div>
        <div className={`shrink-0 whitespace-nowrap font-semibold tabular-nums ${tone(period.pnl)}`}>{formatMoney(period.pnl, currency, hidden)}</div>
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-sm tabular-nums">
        <div>
          <dt className={`text-[10px] ${muted}`}>Угод</dt>
          <dd className="font-medium">{period.count}</dd>
        </div>
        <div>
          <dt className={`text-[10px] ${muted}`}>Winrate</dt>
          <dd className="font-medium">{hidden ? "****" : `${period.winRate}%`}</dd>
        </div>
        <div>
          <dt className={`text-[10px] ${muted}`}>Сума R</dt>
          <dd className={`font-medium ${tone(period.sumR)}`}>{formatR(period.sumR, hidden)}</dd>
        </div>
      </dl>
      <details className="group mt-1 border-t border-border/60">
        <summary className={`flex min-h-11 cursor-pointer items-center text-xs ${muted}`}>Додаткові показники <ChevronDown aria-hidden className="ml-1 h-3.5 w-3.5 transition-transform group-open:rotate-180" /></summary>
        <dl className="grid gap-1.5 pb-3 text-sm tabular-nums">
          <div className="flex items-baseline justify-between gap-3">
            <dt className={`text-xs ${muted}`}>Серед. R</dt>
            <dd className={`font-medium ${tone(period.avgR)}`}>{formatR(period.avgR, hidden)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className={`text-xs ${muted}`}>Краща</dt>
            <dd className="whitespace-nowrap font-medium text-success">{extremeText(period.best, currency, hidden)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className={`text-xs ${muted}`}>Гірша</dt>
            <dd className="whitespace-nowrap font-medium text-danger">{extremeText(period.worst, currency, hidden)}</dd>
          </div>
        </dl>
      </details>
    </li>
  );
}

function PeriodCards({ months, allTime, currency, hidden }: { months: Period[]; allTime: Period; currency: string; hidden: boolean }) {
  return (
    <div className="md:hidden">
      <ul className="grid gap-2" aria-label="Місяці">
        {months.map((period) => (
          <PeriodCard key={period.key} period={period} currency={currency} hidden={hidden} />
        ))}
      </ul>
      <ul className="mt-4 border-t-2 border-primary/40 pt-4" aria-label="Весь час">
        <PeriodCard period={allTime} currency={currency} hidden={hidden} total />
      </ul>
    </div>
  );
}

function Breakdown({ title, rows, currency, hidden }: { title: string; rows: Row[]; currency: string; hidden: boolean }) {
  return (
    <div>
      <div className="mb-1 text-sm font-semibold">{title}</div>
      {rows.length ? (
        <ul className="divide-y divide-border/60">
          {rows.map((row) => (
            <li key={row.name} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <div className="min-w-0">
                <div className="truncate font-medium">{row.name}</div>
                <div className={`text-xs ${muted}`}>
                  {row.count} угод · {hidden ? "****" : `${row.winRate}%`} виграшних
                </div>
              </div>
              <div className={`shrink-0 whitespace-nowrap font-semibold tabular-nums ${tone(row.pnl)}`}>{formatMoney(row.pnl, currency, hidden)}</div>
            </li>
          ))}
        </ul>
      ) : (
        <div className={empty}>Поки порожньо</div>
      )}
    </div>
  );
}

export function FxStatistics({ data, brokers, flows, hidden = false }: { data: FxData; brokers: Broker[]; flows: Flows; hidden?: boolean }) {
  const currency = brokers[0]?.currency || "USD";

  return (
    <>
      <Card className="mt-0 md:mt-4">
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          <Metric
            label="Баланс (FX брокер)"
            value={
              brokers.length
                ? brokers.map((broker) => formatMoney(broker.balance, broker.currency, hidden)).join(" · ")
                : "Рахунок брокера ще не створено"
            }
          />
          <div className="grid min-w-0 grid-cols-2 divide-x divide-border rounded-lg bg-muted p-2.5 sm:p-3">
            <ProfitHalf
              label="Total profit"
              money={amountOnly(data.totalPnl, currency, hidden)}
              r={formatR(data.allTime.sumR, hidden)}
              value={data.totalPnl}
              currency={currency}
              hidden={hidden}
            />
            <ProfitHalf
              label="За місяць"
              money={amountOnly(data.monthPnl, currency, hidden)}
              r={formatR(data.monthSumR, hidden)}
              value={data.monthPnl}
              currency={currency}
              hidden={hidden}
            />
          </div>
          <Metric label="Winrate" value={hidden ? "****" : `${data.winRate}%`} />
          <Metric label="Плюсових / мінусових" value={hidden ? "****" : <><span className="text-success">{data.wins}</span> / <span className="text-danger">{data.losses}</span></>} />
        </div>
      </Card>

      <Card className="mt-4">
        <div className="mb-1 font-semibold">Місяці та весь час</div>
        <details className="group mb-3 text-sm">
          <summary className={`flex min-h-11 cursor-pointer items-center md:min-h-0 md:py-1 ${muted}`}>
            <span className="font-medium tabular-nums">1R = {Number(data.oneRUsd).toFixed(2)} {currency}</span>
            <span className="mx-2 text-xs">·</span>
            <span className="text-xs">Як розраховується R</span>
            <ChevronDown aria-hidden className="ml-1 h-3.5 w-3.5 transition-transform group-open:rotate-180" />
          </summary>
          <p className={`pb-2 ${muted}`}>
            1R — фіксована сума {data.oneRUsd} {currency} (плановий ризик 1% депозиту). R угоди = $ / 1R, тож сума R узгоджується з доларами.
          </p>
        </details>
        {data.count ? (
          <>
            <PeriodCards months={data.byMonth} allTime={data.allTime} currency={currency} hidden={hidden} />
            <PeriodTable months={data.byMonth} allTime={data.allTime} currency={currency} hidden={hidden} />
          </>
        ) : (
          <div className={`${empty} p-5`}>Поки немає угод.</div>
        )}
      </Card>

      <FxPositions trades={data.trades} currency={currency} hidden={hidden} />

      <Card className="mt-4">
        <div className="mb-1 text-sm font-semibold">Депозити та виведення</div>
        {flows.items.length ? (
          <ul className="divide-y divide-border/60">
            {flows.items.map((flow) => (
              <li key={flow.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <div className="font-medium">{flow.direction === "deposit" ? "Поповнення" : "Виведення"}</div>
                  <div className={`text-xs ${muted}`}>{formatDate(flow.date)}</div>
                </div>
                <div className={`shrink-0 whitespace-nowrap font-semibold tabular-nums ${flow.direction === "deposit" ? "text-success" : "text-danger"}`}>
                  {formatMoney(flow.direction === "deposit" ? flow.amount : `-${flow.amount}`, currency, hidden)}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className={empty}>Поповнень ще не внесено</div>
        )}
      </Card>

      <Card className="mt-4">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <div>
            <div className="font-semibold">PnL по днях</div>
            <div className={`text-xs ${muted}`}>Накопичений результат</div>
          </div>
          <div className={`text-xs ${muted}`}>{currency}</div>
        </div>
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
