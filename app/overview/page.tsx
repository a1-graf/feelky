import Link from "next/link";
import { DashboardStatistics } from "@/components/dashboard-statistics";
import { MetricGrid } from "@/components/metric-grid";
import { PeriodPicker } from "@/components/period-picker";
import { Card } from "@/components/ui/card";
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
  const limitRatio = limit > 0 ? Math.min(1, monthExpense / limit) : 0;
  const overLimit = limit > 0 && monthExpense > limit;
  const netPnl = Number(data.totals.netPnlUsdt);
  const periodPnl = Number(data.totals.periodNetPnlUsdt);
  const signed = (value: number) => (value > 0 ? "+" : "") + formatPlain(value, hidden);
  const tone = (value: number) => (value >= 0 ? "text-emerald-200" : "text-rose-200");
  const turnover = [
    { label: "Steam", value: data.turnover.steamUsdt },
    { label: "Aurum", value: data.turnover.aurumUsdt },
    { label: "Polymarket", value: data.turnover.polyUsdt }
  ];

  return (
    <>
      <div className="hero-gradient relative overflow-hidden rounded-3xl p-5 text-white shadow-soft sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-28 right-16 h-56 w-56 rounded-full bg-black/10 blur-2xl" />
        <div className="relative">
          <div className="flex items-start justify-between gap-3">
            <div className="text-sm font-medium text-white/75">Доступний банк</div>
            <div className="rounded-lg bg-white/20 px-2.5 py-1 text-sm font-bold tabular-nums text-white ring-1 ring-white/30">
              курс {formatPlain(data.rate)} <span className="text-[11px] font-medium text-white/70">UAH/USDT</span>
            </div>
          </div>
          <div className="mt-2 break-words text-4xl font-bold leading-none tracking-tight tabular-nums sm:text-5xl">
            {formatPlain(data.totals.availableBankUsdt, hidden)}
            <span className="text-white/60"> / </span>
            {formatPlain(data.totals.potentialBankUsdt, hidden)}
            <span className="ml-2 text-base font-semibold text-white/60">USDT</span>
          </div>
          <div className="mt-2 text-sm text-white/70">доступно / повний банк · доступно ≈ {asUah(data.totals.availableBankUsdt)}</div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-white/12 px-3 py-2 ring-1 ring-white/20">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-200">В обороті</div>
              <div className="mt-0.5 text-base font-extrabold tabular-nums text-amber-100">{formatMoney(data.turnover.totalUsdt, "USDT", hidden)}</div>
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
            </div>
            <div className="px-1 py-2">
              <div className="text-[11px] uppercase tracking-wide text-white/60">Чистий PnL</div>
              <div className={`mt-0.5 text-base font-semibold tabular-nums ${tone(netPnl)}`}>{signed(netPnl)} USDT</div>
              <div className="mt-0.5 text-xs tabular-nums text-white/70">
                за {data.period.label}: <span className={`font-semibold ${tone(periodPnl)}`}>{signed(periodPnl)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

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
            { label: "Мейн гаманець", value: formatMoney(data.totals.cryptoTotal, "USDT", hidden), subValue: asUah(data.totals.cryptoTotal) },
            { label: "Картка", value: formatMoney(data.totals.cardUah, "UAH", hidden), subValue: asUsdt(data.totals.cardUah) },
            { label: "Готівка", value: formatMoney(data.totals.cashUah, "UAH", hidden), subValue: `${formatMoney(data.totals.cashUsd, "USD", hidden)} cash` },
            { label: "Відкладення", value: formatMoney(data.totals.savingsUah, "UAH", hidden), subValue: asUsdt(data.totals.savingsUah) },
            { label: `Витрати · ${data.period.label}`, value: formatMoney(data.totals.monthExpenseUah, "UAH", hidden), tone: overLimit ? "danger" : "ok", subValue: limit > 0 ? `ліміт ${formatMoney(limit, "UAH", hidden)}` : "без ліміту" },
            { label: "Steam PnL", value: formatMoney(data.steam.profit, "USDT", hidden), tone: Number(data.steam.profit) >= 0 ? "ok" : "danger" }
          ]}
          desktopColumns={3}
        />
      </div>

      {limit > 0 && (data.period.key === "month" || data.period.key === "custom") && (
        <Card className="mt-4 p-4">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium">Ліміт витрат на місяць</span>
            <span className={overLimit ? "font-semibold text-danger" : "text-[hsl(var(--card-muted-foreground))]"}>
              {Math.round((monthExpense / limit) * 100)}%
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
    </>
  );
}
