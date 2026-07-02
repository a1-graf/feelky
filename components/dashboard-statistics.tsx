import { DashboardChart } from "@/components/dashboard-chart";
import { ExpensePieChart } from "@/components/expense-pie-chart";
import { IncomeLineChart } from "@/components/income-line-chart";
import { MetricGrid } from "@/components/metric-grid";
import { TransactionList } from "@/components/transaction-list";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/money";

type DashboardStatsData = {
  rate: string;
  settings: { hideAmounts: boolean; monthlyExpenseLimit?: { toString(): string } | string | null } | null;
  expenseCategories: { name: string; value: string }[];
  incomeSourcesUah: { name: string; value: string }[];
  incomeSourcesUsdt: { name: string; value: string }[];
  incomeTimeline: { date: string; label: string; usdt: number; uah: number }[];
  recentTransactions: Parameters<typeof TransactionList>[0]["items"];
  steam: {
    frozenCapital: string;
    profit: string;
  };
  totals: {
    cryptoTotal: string;
    availableCrypto: string;
    frozenCrypto: string;
    cardUah: string;
    cashUah: string;
    cashUsd: string;
    monthExpenseUah: string;
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
  const monthExpenseColor = expenseLimitColor(data.totals.monthExpenseUah, data.settings?.monthlyExpenseLimit);
  const metricItems = [
    { label: "Мейн гаманець", value: formatMoney(data.totals.cryptoTotal, "USDT", hidden) },
    { label: "Заморожено", value: formatMoney(data.totals.frozenCrypto, "USDT", hidden), tone: "warn" as const },
    { label: "Картки UAH", value: formatMoney(data.totals.cardUah, "UAH", hidden) },
    { label: "Cash UAH", value: formatMoney(data.totals.cashUah, "UAH", hidden) },
    { label: "Cash USD", value: formatMoney(data.totals.cashUsd, "USD", hidden) },
    { label: "Витрати місяця", value: formatMoney(data.totals.monthExpenseUah, "UAH", hidden), valueStyle: monthExpenseColor ? { color: monthExpenseColor } : undefined },
    { label: "В обороті Steam", value: formatMoney(data.steam.frozenCapital, "USDT", hidden), tone: "warn" as const },
    { label: "Steam прибуток", value: formatMoney(data.steam.profit, "USDT", hidden), tone: "ok" as const }
  ];

  return (
    <section className="mt-5">
      <div className="mb-3 text-sm font-semibold text-muted-foreground">Статистика</div>
      <MetricGrid items={metricItems} />

      <Card className="mt-5">
        <div className="mb-1 font-semibold">Куди йдуть витрати</div>
        <div className="mb-3 text-sm text-[hsl(var(--card-muted-foreground))]">Найбільші категорії за всіма тратами</div>
        <ExpensePieChart data={data.expenseCategories} hidden={hidden} emptyLabel="Поки немає витрат" />
      </Card>

      <Card className="mt-4">
        <div className="mb-1 font-semibold">Доходи</div>
        <div className="mb-3 text-sm text-[hsl(var(--card-muted-foreground))]">USDT суцільною лінією, UAH пунктирною</div>
        <IncomeLineChart data={data.incomeTimeline} hidden={hidden} />
      </Card>

      <Card className="mt-4">
        <div className="mb-3 font-semibold">Структура банку</div>
        <DashboardChart
          data={[
            { name: "Мейн гаманець", value: Number(data.totals.availableCrypto) },
            { name: "В обороті", value: Number(data.steam.frozenCapital) },
            { name: "UAH", value: Number(data.totals.cardUah) / Number(data.rate) },
            { name: "Cash USD", value: Number(data.totals.cashUsd) },
            { name: "Заморожено", value: Number(data.totals.frozenCrypto) }
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
