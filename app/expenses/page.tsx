import { TransactionType } from "@prisma/client";
import { BackToStatistics } from "@/components/back-to-statistics";
import { AppShell } from "@/components/layout/app-shell";
import { MetricGrid } from "@/components/metric-grid";
import { PageTitle } from "@/components/page-title";
import { TransactionList } from "@/components/transaction-list";
import { prisma } from "@/lib/db";
import { formatMoney, sumDecimals } from "@/lib/money";
import { requireUserId } from "@/lib/session";

export default async function ExpensesPage() {
  const userId = await requireUserId();
  const transactions = await prisma.transaction.findMany({
    where: { userId, archivedAt: null, type: TransactionType.EXPENSE },
    include: { sourceAccount: true, category: true },
    orderBy: { transactionDate: "desc" }
  });
  const totalUah = sumDecimals(transactions.filter((item) => item.currency === "UAH").map((item) => item.amount));
  const totalUsdt = sumDecimals(transactions.filter((item) => item.currency === "USDT").map((item) => item.amount));
  const byCategory = new Map<string, string>();
  for (const item of transactions.filter((transaction) => transaction.currency === "UAH")) {
    const key = item.category?.name || "Інше";
    byCategory.set(key, formatMoney(sumDecimals(transactions.filter((t) => t.currency === "UAH" && (t.category?.name || "Інше") === key).map((t) => t.amount)), "UAH"));
  }
  return (
    <AppShell>
      <BackToStatistics />
      <PageTitle title="Витрати" subtitle="UAH та USDT витрати з контролем негативного балансу" />
      <MetricGrid items={[{ label: "Загалом UAH", value: formatMoney(totalUah, "UAH"), tone: "danger" }, { label: "Загалом USDT", value: formatMoney(totalUsdt, "USDT"), tone: "danger" }, { label: "Операцій", value: String(transactions.length) }, ...Array.from(byCategory).slice(0, 2).map(([label, value]) => ({ label, value }))]} />
      <div className="mt-5">
        <TransactionList items={transactions} />
      </div>
    </AppShell>
  );
}
