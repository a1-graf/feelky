import Link from "next/link";
import { DashboardStatistics } from "@/components/dashboard-statistics";
import { MetricGrid } from "@/components/metric-grid";
import { PeriodPicker } from "@/components/period-picker";
import { RangeAreaChart } from "@/components/range-area-chart";
import { Card } from "@/components/ui/card";
import { bankSeries } from "@/lib/bank-history";
import { getDashboard } from "@/lib/dashboard";
import { formatMoney, formatPercent, formatPlain } from "@/lib/money";
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
  const limitRatio = limit > 0 ? Math.min(1, monthExpense / limit) : 0;
  const overLimit = limit > 0 && monthExpense > limit;
  const netPnl = Number(data.totals.netPnlUsdt);
  const periodPnl = Number(data.totals.periodNetPnlUsdt);
  const signed = (value: number) => (value > 0 ? "+" : "") + formatPlain(value, hidden);
  const tone = (value: number) => (value >= 0 ? "text-[hsl(var(--hero-pos))]" : "tone-neg text-[hsl(var(--hero-neg))]");
  const signedUsdt = (value: string) => `${Number(value) > 0 ? "+" : ""}${formatMoney(value, "USDT", hidden)}`;
  const moveTone = (value: string) => (Number(value) > 0 ? "ok" : Number(value) < 0 ? "danger" : undefined);
  const turnover = [
    { label: "Steam", value: data.turnover.steamUsdt },
    { label: "Aurum", value: data.turnover.aurumUsdt },
    { label: "Polymarket", value: data.turnover.polyUsdt }
  ];

  const accounts = [
    { icon: "💵", label: "Мейн гаманець", value: formatMoney(data.totals.cryptoTotal, "USDT", hidden), sub: asUah(data.totals.cryptoTotal) },
    { icon: "💳", label: "Картка", value: formatMoney(data.totals.cardUah, "UAH", hidden), sub: asUsdt(data.totals.cardUah) },
    { icon: "👛", label: "Готівка", value: formatMoney(data.totals.cashUah, "UAH", hidden), sub: `${formatMoney(data.totals.cashUsd, "USD", hidden)} cash` },
    { icon: "🏦", label: "Відкладення", value: formatMoney(data.totals.savingsUah, "UAH", hidden), sub: asUsdt(data.totals.savingsUah) }
  ];

  return (
    <>
      <div className="hero-gradient relative overflow-hidden rounded-3xl p-5 text-[hsl(var(--hero-fg))] shadow-soft sm:p-7">
        <div className="hero-blob pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <div className="hero-blob pointer-events-none absolute -bottom-28 right-16 h-56 w-56 rounded-full bg-black/10 blur-2xl" />
        <div className="relative">
          <div className="flex items-start justify-between gap-3">
            <div className="hero-label text-sm font-medium text-white/75">Доступний банк</div>
            <div className="rounded-lg bg-white/20 px-2.5 py-1 text-sm font-bold tabular-nums text-white ring-1 ring-white/30">
              курс {formatPlain(data.rate)} <span className="text-[11px] font-medium text-white/70">UAH/USDT</span>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-start gap-x-3 gap-y-2">
            <div>
              <div className="break-words text-4xl font-bold leading-none tracking-tight tabular-nums sm:text-5xl">
                {formatPlain(data.totals.availableBankUsdt, hidden)}
              </div>
              <div className="mt-2 text-sm tabular-nums text-white/70">≈ {asUah(data.totals.availableBankUsdt)}</div>
            </div>
            <div className="text-4xl font-bold leading-none text-white/60 sm:text-5xl">/</div>
            <div>
              <div className="break-words text-4xl font-bold leading-none tracking-tight tabular-nums text-[hsl(var(--hero-accent))] sm:text-5xl">
                {formatPlain(data.totals.potentialBankUsdt, hidden)}
                <span className="ml-2 text-base font-semibold text-[hsl(var(--hero-accent)/0.6)]">USDT</span>
              </div>
              <div className="mt-2 text-sm tabular-nums text-white/70">≈ {asUah(data.totals.potentialBankUsdt)}</div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-white/12 px-3 py-2 ring-1 ring-white/20">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--hero-accent))]">В обороті</div>
              <div className="mt-0.5 text-base font-extrabold tabular-nums text-[hsl(var(--hero-accent-soft))]">{formatMoney(data.turnover.totalUsdt, "USDT", hidden)}</div>
              <div className="mt-0.5 text-xs tabular-nums text-white/70">≈ {asUah(data.turnover.totalUsdt)}</div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {turnover.map((item) => (
                  <span key={item.label} className="rounded-md bg-black/15 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-white/85">
                    {item.label} {formatPlain(item.value, hidden)}
                  </span>
                ))}
              </div>
            </div>
            <div className="px-1 py-2">
              <div className="text-[11px] uppercase tracking-wide text-white/60">❄️ Заморожено</div>
              <div className="mt-0.5 text-base font-semibold tabular-nums text-white/90">{formatMoney(data.totals.frozenTotalUsdt, "USDT", hidden)}</div>
              <div className="mt-0.5 text-xs tabular-nums text-white/70">≈ {asUah(data.totals.frozenTotalUsdt)}</div>
            </div>
            <div className="px-1 py-2">
              <div className="text-[11px] uppercase tracking-wide text-white/60">Чистий PnL</div>
              <div className={`mt-0.5 text-base font-semibold tabular-nums ${tone(netPnl)}`}>{signed(netPnl)} USDT</div>
              <div className="mt-0.5 text-xs tabular-nums text-white/70">≈ {asUah(String(netPnl))}</div>
              <div className="mt-0.5 text-xs tabular-nums text-white/70">
                за {data.period.label}: <span className={`font-semibold ${tone(periodPnl)}`}>{signed(periodPnl)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Card className="mt-3">
        <div className="mb-2 font-semibold">Загальний банк</div>
        <RangeAreaChart data={bankSeries(data.bankHistory, "total")} currency="USDT" hidden={hidden} totalLabel="Банк" emptyLabel="Поки немає історії" defaultPreset="1m" minimal />
      </Card>

      <div className="mt-3 grid grid-cols-3 gap-2 md:hidden">
        {mobileLinks.map((link) => (
          <Link key={link.href} href={link.href} className="flex min-h-12 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 px-2 py-2.5 text-center text-xs font-semibold text-primary shadow-card active:bg-muted">
            {link.label}
          </Link>
        ))}
      </div>

      <div className="mt-3">
        <PeriodPicker
          basePath="/overview"
          period={data.period}
          presets={["week", "month", "3m", "all"]}
        />
        <div className="mt-1.5 px-1 text-xs text-[hsl(var(--card-muted-foreground))]">
          Банк зверху — на зараз, усе нижче — за період: <span className="font-semibold text-[hsl(var(--card-foreground))]">{data.period.label}</span>
        </div>
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
            <span className={overLimit ? "font-semibold text-danger" : "text-[hsl(var(--card-muted-foreground))]"}>
              {formatPercent((monthExpense / limit) * 100)}
            </span>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all ${overLimit ? "bg-danger" : limitRatio > 0.8 ? "bg-warning" : "bg-success"}`}
              style={{ width: `${Math.max(2, limitRatio * 100)}%` }}
            />
          </div>
        </Card>
      )}

      <DashboardStatistics data={data} />

      <Card className="mt-4">
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
    </>
  );
}
