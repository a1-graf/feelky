import { BalanceGrowthChart } from "@/components/balance-growth-chart";
import { DashboardChart } from "@/components/dashboard-chart";
import { ExpensePieChart } from "@/components/expense-pie-chart";
import { IncomeLineChart, IncomeSourceGrowthChart, LossBreakdownChart, NetPnlChart } from "@/components/income-line-chart";
import { MetricGrid } from "@/components/metric-grid";
import { TransactionList } from "@/components/transaction-list";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/money";

type DashboardStatsData = {
  rate: string;
  settings: { hideAmounts: boolean; monthlyExpenseLimit?: { toString(): string } | string | null } | null;
  expenseCategories: { name: string; value: string }[];
  workExpenseSourcesUsdt: { name: string; value: string }[];
  incomeSourcesUah: { name: string; value: string }[];
  incomeSourcesUsdt: { name: string; value: string }[];
  incomeTimeline: { date: string; label: string; usdt: number; uah: number }[];
  incomeSourceTimeline: { date: string; label: string; sources: { name: string; value: number }[] }[];
  pnlTimeline: { date: string; label: string; profit: number; loss: number; net: number }[];
  lossBreakdown: { name: string; value: string }[];
  balanceTimeline: { date: string; label: string; tooltipLabel?: string; eventIndex?: number; full: number; available: number }[];
  recentTransactions: Parameters<typeof TransactionList>[0]["items"];
  steam: {
    frozenCapital: string;
    profit: string;
  };
  totals: {
    cryptoTotal: string;
    availableCrypto: string;
    frozenCrypto: string;
    frozenTotalUsdt: string;
    cardUah: string;
    cashUah: string;
    cashUsd: string;
    savingsUah: string;
    monthExpenseUah: string;
    totalProfitUsdt: string;
    totalLossUsdt: string;
    netPnlUsdt: string;
  };
};

function mixColor(from: [number, number, number], to: [number, number, number], progress: number) {
  const clamped = Math.max(0, Math.min(1, progress));
  const [r, g, b] = from.map((value, index) => Math.round(value + (to[index] - value) * clamped));
  return `rgb(${r}, ${g}, ${b})`;
}

function expenseLimitColor(expense: string, limit?: { toString(): string } | string | null) {
  const spent = Number(expense);
  const max = Number(limit?.toString() || 0);
  if (!Number.isFinite(spent) || !Number.isFinite(max) || max <= 0) return undefined;
  const ratio = spent / max;
  const green: [number, number, number] = [45, 154, 103];
  const gray: [number, number, number] = [116, 118, 126];
  const red: [number, number, number] = [224, 77, 101];
  return ratio <= 1 ? mixColor(green, gray, ratio) : mixColor(gray, red, Math.min(1, ratio - 1));
}

export function DashboardStatistics({ data }: { data: DashboardStatsData }) {
  const hidden = Boolean(data.settings?.hideAmounts);
  const rate = Number(data.rate);
  const asUah = (value: string) => formatMoney(Number(value) * rate, "UAH", hidden);
  const asUsdt = (value: string) => formatMoney(Number(value) / rate, "USDT", hidden);
  const monthExpenseColor = expenseLimitColor(data.totals.monthExpenseUah, data.settings?.monthlyExpenseLimit);
  const hasWorkExpenses = data.workExpenseSourcesUsdt.some((item) => Number(item.value) > 0);
  const metricItems = [
    { label: "Мейн гаманець", value: formatMoney(data.totals.cryptoTotal, "USDT", hidden), subValue: asUah(data.totals.cryptoTotal) },
    { label: "Заморожено", value: formatMoney(data.totals.frozenTotalUsdt, "USDT", hidden), subValue: asUah(data.totals.frozenTotalUsdt), tone: "warn" as const },
    { label: "Картки UAH", value: formatMoney(data.totals.cardUah, "UAH", hidden) },
    { label: "Cash UAH", value: formatMoney(data.totals.cashUah, "UAH", hidden) },
    { label: "Cash USD", value: formatMoney(data.totals.cashUsd, "USD", hidden), subValue: asUah(data.totals.cashUsd) },
    { label: "Відкладення", value: formatMoney(data.totals.savingsUah, "UAH", hidden), subValue: asUsdt(data.totals.savingsUah), tone: "ok" as const },
    { label: "Витрати місяця", value: formatMoney(data.totals.monthExpenseUah, "UAH", hidden), valueStyle: monthExpenseColor ? { color: monthExpenseColor } : undefined },
    { label: "В обороті Steam", value: formatMoney(data.steam.frozenCapital, "USDT", hidden), subValue: asUah(data.steam.frozenCapital), tone: "warn" as const },
    { label: "Steam прибуток", value: formatMoney(data.steam.profit, "USDT", hidden), subValue: asUah(data.steam.profit), tone: "ok" as const },
    { label: "Всього плюсів", value: formatMoney(data.totals.totalProfitUsdt, "USDT", hidden), subValue: asUah(data.totals.totalProfitUsdt), tone: "ok" as const },
    { label: "Всього мінусів", value: formatMoney(data.totals.totalLossUsdt, "USDT", hidden), subValue: asUah(data.totals.totalLossUsdt), tone: "danger" as const },
    { label: "Чистий PnL", value: formatMoney(data.totals.netPnlUsdt, "USDT", hidden), subValue: asUah(data.totals.netPnlUsdt), tone: Number(data.totals.netPnlUsdt) >= 0 ? "ok" as const : "danger" as const }
  ];

  return (
    <section className="mt-5">
      <div className="mb-3 text-sm font-semibold text-muted-foreground">Статистика</div>
      <MetricGrid items={metricItems} desktopColumns={3} />

      <Card className="mt-5">
        <div className="mb-1 font-semibold">Ріст балансу</div>
        <div className="mb-3 text-sm text-[hsl(var(--card-muted-foreground))]">Повний банк і доступний банк з урахуванням Steam в обороті</div>
        <BalanceGrowthChart data={data.balanceTimeline} rate={data.rate} hidden={hidden} />
      </Card>

      <Card className="mt-5">
        <div className="mb-1 font-semibold">Чистий PnL</div>
        <div className="mb-3 text-sm text-[hsl(var(--card-muted-foreground))]">Наростаючі плюси, мінуси і чистий результат у USDT</div>
        <NetPnlChart data={data.pnlTimeline} hidden={hidden} />
        <div className="my-5 border-t border-border" />
        <div className="mb-1 font-semibold">Де найбільші мінуси</div>
        <div className="mb-3 text-sm text-[hsl(var(--card-muted-foreground))]">Топ просадок по витратах, робочих напрямках і мінусових фліпах</div>
        <LossBreakdownChart data={data.lossBreakdown} hidden={hidden} />
      </Card>

      <Card className="mt-5">
        <div className="mb-1 font-semibold">Куди йдуть витрати</div>
        <div className="mb-3 text-sm text-[hsl(var(--card-muted-foreground))]">Особисті витрати в UAH та робочі витрати за напрямками</div>
        <div className={hasWorkExpenses ? "grid gap-6 xl:grid-cols-2" : ""}>
          <div className="min-w-0">
            {hasWorkExpenses && <div className="mb-2 text-sm font-semibold text-[hsl(var(--card-muted-foreground))]">Особисті · UAH</div>}
            <ExpensePieChart data={data.expenseCategories} hidden={hidden} emptyLabel="Поки немає витрат" />
          </div>
          {hasWorkExpenses && (
            <div className="min-w-0">
              <div className="mb-2 text-sm font-semibold text-[hsl(var(--card-muted-foreground))]">Робочі · USDT</div>
              <ExpensePieChart data={data.workExpenseSourcesUsdt} hidden={hidden} emptyLabel="" currency="USDT" />
            </div>
          )}
        </div>
      </Card>

      <Card className="mt-4">
        <div className="mb-1 font-semibold">Наростаючий дохід</div>
        <div className="mb-3 text-sm text-[hsl(var(--card-muted-foreground))]">Усі лінії та ліва шкала показані в USDT</div>
        <IncomeLineChart data={data.incomeTimeline} rate={data.rate} hidden={hidden} />
        <div className="my-5 border-t border-border" />
        <div className="mb-1 font-semibold">Що приносить дохід</div>
        <div className="mb-3 text-sm text-[hsl(var(--card-muted-foreground))]">Наростаючий результат топ-5 напрямків у перерахунку на USDT</div>
        <IncomeSourceGrowthChart data={data.incomeSourceTimeline} hidden={hidden} />
      </Card>

      <Card className="mt-4">
        <div className="mb-3 font-semibold">Структура банку</div>
        <DashboardChart
          data={[
            { name: "Мейн гаманець", value: Number(data.totals.availableCrypto) },
            { name: "В обороті", value: Number(data.steam.frozenCapital) },
            { name: "UAH", value: Number(data.totals.cardUah) / Number(data.rate) },
            { name: "Cash UAH", value: Number(data.totals.cashUah) / Number(data.rate) },
            { name: "Cash USD", value: Number(data.totals.cashUsd) },
            { name: "Відкладення", value: Number(data.totals.savingsUah) / Number(data.rate) },
            { name: "Заморожено", value: Number(data.totals.frozenTotalUsdt) }
          ]}
        />
      </Card>

      <Card className="mt-4">
        <div className="mb-2 text-sm font-semibold">Останні операції</div>
        <TransactionList items={data.recentTransactions} compact />
      </Card>
    </section>
  );
}
