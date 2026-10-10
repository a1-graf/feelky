import { BalanceGrowthChart } from "@/components/balance-growth-chart";
import { DashboardChart } from "@/components/dashboard-chart";
import { ExpensePieChart } from "@/components/expense-pie-chart";
import { IncomeLineChart, IncomeSourceGrowthChart, LossBreakdownChart, NetPnlChart } from "@/components/income-line-chart";
import { TransactionList } from "@/components/transaction-list";
import { Card } from "@/components/ui/card";

type DashboardStatsData = {
  period: { month: string; label: string; rangeLabel: string; isCurrentMonth: boolean; from?: string; to?: string };
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

function ExpenseHeading({ title, currency }: { title: string; currency: string }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <span className="text-sm font-semibold">{title}</span>
      <span className="rounded-md bg-[hsl(var(--muted))] px-2 py-0.5 text-xs font-medium text-[hsl(var(--card-muted-foreground))]">{currency}</span>
    </div>
  );
}

/** Everything about the chosen period, under the bank on the overview page. */
export function DashboardStatistics({ data }: { data: DashboardStatsData }) {
  const hidden = Boolean(data.settings?.hideAmounts);
  const hasWorkExpenses = data.workExpenseSourcesUsdt.some((item) => Number(item.value) > 0);

  return (
    <section>
      <Card className="mt-4">
        <div className="mb-1 font-semibold">Ріст балансу</div>
        <div className="mb-3 text-sm text-[hsl(var(--card-muted-foreground))]">Повний банк і доступний банк з урахуванням Steam в обороті</div>
        <BalanceGrowthChart data={data.balanceTimeline} rate={data.rate} hidden={hidden} />
      </Card>

      <Card className="mt-4">
        <div className="mb-1 font-semibold">Чистий PnL</div>
        <div className="mb-3 text-sm text-[hsl(var(--card-muted-foreground))]">Скільки зароблено чи втрачено кожного дня і як це накопичувалось · {data.period.rangeLabel}</div>
        <NetPnlChart data={data.pnlTimeline} hidden={hidden} from={data.period.from} to={data.period.to} />
        <div className="my-6 border-t border-border" />
        <div className="mb-1 font-semibold">Де найбільші мінуси</div>
        <div className="mb-4 text-sm text-[hsl(var(--card-muted-foreground))]">Витрати, робочі напрямки і мінусові фліпи за період</div>
        <LossBreakdownChart data={data.lossBreakdown} hidden={hidden} />
      </Card>

      <Card className="mt-4">
        <div className="mb-1 font-semibold">Куди йдуть витрати</div>
        <div className="mb-4 text-sm text-[hsl(var(--card-muted-foreground))]">Особисті витрати в UAH та робочі витрати за напрямками · {data.period.rangeLabel}</div>
        <div className={hasWorkExpenses ? "grid gap-6 xl:grid-cols-2" : ""}>
          <div className={hasWorkExpenses ? "min-w-0 rounded-xl border border-border p-4" : "min-w-0"}>
            {hasWorkExpenses && <ExpenseHeading title="Особисті" currency="UAH" />}
            <ExpensePieChart data={data.expenseCategories} hidden={hidden} emptyLabel="Поки немає витрат" />
          </div>
          {hasWorkExpenses && (
            <div className="min-w-0 rounded-xl border border-border p-4">
              <ExpenseHeading title="Робочі" currency="USDT" />
              <ExpensePieChart data={data.workExpenseSourcesUsdt} hidden={hidden} emptyLabel="" currency="USDT" />
            </div>
          )}
        </div>
      </Card>

      <Card className="mt-4">
        <div className="mb-1 font-semibold">Наростаючий дохід</div>
        <div className="mb-3 text-sm text-[hsl(var(--card-muted-foreground))]">Усі лінії та ліва шкала показані в USDT · {data.period.rangeLabel}</div>
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
        <div className="mb-2 text-sm font-semibold">Останні операції за період</div>
        <TransactionList items={data.recentTransactions} compact />
      </Card>
    </section>
  );
}
