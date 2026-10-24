import Link from "next/link";
import { DashboardStatistics } from "@/components/dashboard-statistics";
import { MetricGrid } from "@/components/metric-grid";
import { PeriodPicker } from "@/components/period-picker";
import { RangeAreaChart } from "@/components/range-area-chart";
import { Card } from "@/components/ui/card";
import { limitColor } from "@/lib/limit-color";
import { bankSeries } from "@/lib/bank-history";
import { getDashboard } from "@/lib/dashboard";
import { formatMoney, formatPlain } from "@/lib/money";
import { requireUserId } from "@/lib/session";

const mobileLinks = [
  { href: "/fx", label: "FX" },
  { href: "/poly", label: "Polymarket" },
  { href: "/steam", label: "Steam" }
];

/** The one main page: the bank right now on top, then everything about the chosen period. */
export default async function OverviewPage({ searchParams }: { searchParams?: Promise<{ month?: string; period?: string }> }) {
  const userId = await requireUserId();
  const params = await searchParams;
  const data = await getDashboard(userId, { month: params?.month, period: params?.period });
  const hidden = Boolean(data.settings?.hideAmounts);
  const rate = Number(data.rate);
  const asUah = (value: string) => formatMoney(Number(value) * rate, "UAH", hidden);
  const asUsdt = (value: string) => formatMoney(Number(value) / rate, "USDT", hidden);
  const monthExpense = Number(data.totals.monthExpenseUah);
  const limit = Number(data.settings?.monthlyExpenseLimit?.toString() || 0);
  const limitUsed = limit > 0 ? monthExpense / limit : 0;
  const overLimit = limit > 0 && monthExpense > limit;
  const netPnl = Number(data.totals.netPnlUsdt);
  const periodPnl = Number(data.totals.periodNetPnlUsdt);
  const signed = (value: number) => (value > 0 ? "+" : "") + formatPlain(value, hidden);
  const tone = (value: number) => (value >= 0 ? "text-emerald-200" : "text-rose-200");
  const signedUsdt = (value: string) => `${Number(value) > 0 ? "+" : ""}${formatMoney(Number(value).toFixed(2), "USDT", hidden)}`;
  const moveTone = (value: string) => (Number(value) > 0 ? "ok" : Number(value) < 0 ? "danger" : undefined);
  const periodBankChange = Number(data.totals.periodBankChangeUsdt);
  const periodOther = Number(data.totals.periodOtherUsdt);
  const turnover = [
    { label: "Steam", value: data.turnover.steamUsdt, className: "bg-slate-500/80 text-white" },
    { label: "Aurum", value: data.turnover.aurumUsdt, className: "bg-amber-400 text-amber-950" },
    { label: "Polymarket", value: data.turnover.polyUsdt, className: "bg-blue-600 text-white" }
  ];
  const chip = "rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums";
  const plainChip = `${chip} bg-black/20 text-white/90`;
  const tileClass = "min-w-0 rounded-xl bg-white/10 px-3 py-2.5 ring-1 ring-white/30";
  const tileLabel = "text-[11px] font-semibold uppercase tracking-wide text-white/85";
  const tileValue = "mt-0.5 break-words text-base font-extrabold tabular-nums text-white";
  const tileSub = "text-xs tabular-nums text-white/65";

  const accounts = [
    { icon: "💵", label: "Мейн гаманець", value: formatMoney(data.totals.cryptoTotal, "USDT", hidden), sub: asUah(data.totals.cryptoTotal) },
    { icon: "💳", label: "Картка", value: formatMoney(data.totals.cardUah, "UAH", hidden), sub: asUsdt(data.totals.cardUah) },
    { icon: "👛", label: "Готівка", value: formatMoney(data.totals.cashUah, "UAH", hidden), sub: `${formatMoney(data.totals.cashUsd, "USD", hidden)} cash` },
    { icon: "🏦", label: "Відкладення", value: formatMoney(data.totals.savingsUah, "UAH", hidden), sub: asUsdt(data.totals.savingsUah) }
  ];

  return (
    <>
      <div>
        <PeriodPicker basePath="/overview" period={data.period} presets={["week", "month", "3m", "all"]} />
        <div className="mt-1.5 px-1 text-xs text-[hsl(var(--card-muted-foreground))]">
          Банк і «зараз» — на цю хвилину; усе з позначкою «{data.period.phrase}» і нижче — за обраний період: <span className="font-semibold text-[hsl(var(--card-foreground))]">{data.period.rangeLabel}</span>
        </div>
      </div>

      <div className="hero-gradient relative mt-3 overflow-hidden rounded-3xl p-5 text-white shadow-soft sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-28 right-16 h-56 w-56 rounded-full bg-black/10 blur-2xl" />
        <div className="relative">
          <div className="flex items-start justify-between gap-3">
            <div className="text-sm font-medium text-white/75">Загальний банк</div>
            <div className="rounded-lg bg-white/20 px-2.5 py-1 text-sm font-bold tabular-nums text-white ring-1 ring-white/30">
              курс {formatPlain(data.rate)} <span className="text-[11px] font-medium text-white/70">UAH/USDT</span>
            </div>
          </div>
          <div className="mt-2 break-words text-4xl font-bold leading-none tracking-tight tabular-nums text-amber-200 sm:text-5xl">
            {formatPlain(data.totals.potentialBankUsdt, hidden)}
            <span className="ml-2 text-base font-semibold text-amber-100/70">USDT</span>
          </div>
          <div className="mt-1.5 text-sm tabular-nums text-white/65">≈ {asUah(data.totals.potentialBankUsdt)}</div>
          <div
            className="mt-3 text-sm text-white/80"
            title="Приріст загального банку за період: усі гроші (доступні, в обороті, заморожені, відкладені) тепер мінус те саме на початок періоду."
          >
            додалось {data.period.phrase}: <span className={`font-semibold tabular-nums ${tone(periodBankChange)}`}>{signed(periodBankChange)} USDT</span>
          </div>
          <div
            className="mt-0.5 text-xs text-white/65"
            title="Результат = доходи + Aurum + Polymarket + фліпи − витрати. Решта — гроші, що з'явились/зникли не як результат: зовнішні поповнення й виведення, ручні корекції балансу, зміна курсу."
          >
            з них результат (дохід − витрати + торгівля): <span className="tabular-nums">{signed(periodPnl)}</span>, інше (поповнення, ручні корекції, курс): <span className="tabular-nums">{signed(periodOther)}</span>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className={tileClass} title="Гроші, якими можна розпоряджатися: Мейн гаманець + картка + готівка. Без відкладень, заморожених і грошей в обороті.">
              <div className={tileLabel}>Доступний банк</div>
              <div className={tileValue}>{formatPlain(data.totals.availableBankUsdt, hidden)} USDT</div>
              <div className={tileSub}>≈ {asUah(data.totals.availableBankUsdt)}</div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                <span className={plainChip}>гаманець {formatPlain(data.totals.availableCrypto, hidden)}</span>
                <span className={plainChip}>картка {formatPlain(data.totals.cardUah, hidden)} ₴</span>
                <span className={plainChip}>готівка {formatPlain(data.totals.cashUah, hidden)} ₴{Number(data.totals.cashUsd) > 0 ? ` + ${formatPlain(data.totals.cashUsd, hidden)} $` : ""}</span>
              </div>
            </div>
            <div className={tileClass} title="Гроші, що працюють: реальні USDT, завезені в Steam (активні завози й круги) + баланс брокера Aurum + Polymarket (пул і суми, замкнені в AI-агентах).">
              <div className={tileLabel}>Банк в обороті</div>
              <div className={tileValue}>{formatPlain(data.turnover.totalUsdt, hidden)} USDT</div>
              <div className={tileSub}>≈ {asUah(data.turnover.totalUsdt)}</div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {turnover.map((item) => (
                  <span key={item.label} className={`${chip} ${item.className}`}>
                    {item.label} {formatPlain(item.value, hidden)}
                  </span>
                ))}
              </div>
            </div>
            <div className={tileClass} title="Власні USDT, заморожені на біржах, і гроші, які ще очікуються (не отримані).">
              <div className={tileLabel}>❄️ Заморожено</div>
              <div className={tileValue}>{formatPlain(data.totals.frozenTotalUsdt, hidden)} USDT</div>
              <div className={tileSub}>≈ {asUah(data.totals.frozenTotalUsdt)}</div>
            </div>
            <div className={tileClass} title="Чистий PnL = доходи + Aurum + Polymarket + фліпи − усі витрати. Не включає поповнення/виведення, перекази між рахунками і ручні корекції балансу.">
              <div className={tileLabel}>Чистий PnL</div>
              <div className={`mt-0.5 text-base font-extrabold tabular-nums ${tone(periodPnl)}`}>{signed(periodPnl)} USDT</div>
              <div className={tileSub}>{data.period.phrase}</div>
              <div className={`${tileSub} mt-0.5`}>
                за весь час: <span className={`font-semibold ${tone(netPnl)}`}>{signed(netPnl)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Card className="mt-3">
        <div className="mb-2 font-semibold">Загальний банк</div>
        <RangeAreaChart
          key={`bank-${data.period.key}-${data.period.month}`}
          data={bankSeries(data.bankHistory, "total")}
          currency="USDT"
          hidden={hidden}
          totalLabel="Банк"
          emptyLabel="Поки немає історії"
          defaultPreset="period"
          periodStart={data.period.fromMs}
          periodEnd={data.period.toMs}
          periodPhrase={data.period.phrase}
          valueCaption="Усі гроші разом: доступні, в обороті, заморожені, відкладені"
          minimal
        />
      </Card>

      <Card className="mt-3">
        <div className="mb-3 font-semibold">Рахунки</div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          {accounts.map((account) => (
            <div key={account.label} className="min-w-0">
              <dt className="text-xs text-[hsl(var(--card-muted-foreground))]">{account.icon} {account.label}</dt>
              <dd className="mt-0.5 break-words text-base font-bold tabular-nums">{account.value}</dd>
              <dd className="text-xs tabular-nums text-[hsl(var(--card-muted-foreground))]">{account.sub}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <div className="mt-3 grid grid-cols-3 gap-2 md:hidden">
        {mobileLinks.map((link) => (
          <Link key={link.href} href={link.href} className="flex min-h-12 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 px-2 py-2.5 text-center text-xs font-semibold text-primary shadow-card active:bg-muted">
            {link.label}
          </Link>
        ))}
      </div>

      <div className="mt-4">
        <MetricGrid
          items={[
            { icon: "💸", label: `Витрати · ${data.period.label}`, value: formatMoney(data.totals.monthExpenseUah, "UAH", hidden), tone: overLimit ? "danger" : undefined, subValue: limit > 0 ? `ліміт ${formatMoney(limit, "UAH", hidden)}` : asUsdt(data.totals.monthExpenseUah) },
            { icon: "💰", label: "Прибуток", value: signedUsdt(data.totals.periodGrossUsdt), tone: moveTone(data.totals.periodGrossUsdt), subValue: "доходи, Aurum, Poly, фліпи" },
            { icon: "💎", label: "Чистий прибуток", value: signedUsdt(data.totals.periodNetPnlUsdt), tone: moveTone(data.totals.periodNetPnlUsdt), subValue: "після витрат" },
            { icon: "🎮", label: "Дохід по Steam", value: signedUsdt(data.totals.periodSteamUsdt), tone: moveTone(data.totals.periodSteamUsdt), subValue: `в обороті ${formatMoney(data.turnover.steamUsdt, "USDT", hidden)}` },
            { icon: "📈", label: "Дохід по Aurum", value: signedUsdt(data.totals.periodFxUsdt), tone: moveTone(data.totals.periodFxUsdt), subValue: `в обороті ${formatMoney(data.turnover.aurumUsdt, "USDT", hidden)}` },
            { icon: "🎯", label: "Дохід по Polymarket", value: signedUsdt(data.totals.periodPolyUsdt), tone: moveTone(data.totals.periodPolyUsdt), subValue: `в обороті ${formatMoney(data.turnover.polyUsdt, "USDT", hidden)}` }
          ]}
          desktopColumns={3}
        />
      </div>

      {limit > 0 && (data.period.key === "month" || data.period.key === "custom") && (
        <Card className="mt-4 p-4">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium">Ліміт витрат на місяць</span>
            <span className="font-semibold tabular-nums" style={{ color: limitColor(limitUsed) }}>
              {Math.round(limitUsed * 100)}%
            </span>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, Math.max(2, limitUsed * 100))}%`, backgroundColor: limitColor(limitUsed) }} />
          </div>
          <div className="mt-1.5 text-xs tabular-nums text-[hsl(var(--card-muted-foreground))]">
            {formatMoney(monthExpense.toFixed(2), "UAH", hidden)} із {formatMoney(limit, "UAH", hidden)}
            {overLimit && !hidden && ` · перевищено на ${formatMoney((monthExpense - limit).toFixed(2), "UAH")}`}
          </div>
        </Card>
      )}

      <DashboardStatistics data={data} />
    </>
  );
}
