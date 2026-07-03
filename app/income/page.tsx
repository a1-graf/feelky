import { TransactionType } from "@prisma/client";
import { BackToStatistics } from "@/components/back-to-statistics";
import { AppShell } from "@/components/layout/app-shell";
import { MetricGrid } from "@/components/metric-grid";
import { PageTitle } from "@/components/page-title";
import { TransactionList } from "@/components/transaction-list";
import { prisma } from "@/lib/db";
import { formatMoney, sumDecimals } from "@/lib/money";
import { requireUserId } from "@/lib/session";
import { isOpeningBalanceTransaction } from "@/lib/transaction-utils";

export default async function IncomePage() {
  const userId = await requireUserId();
  const transactions = await prisma.transaction.findMany({
    where: { userId, archivedAt: null, type: { in: [TransactionType.INCOME, TransactionType.EXPECTED_MONEY_RECEIVED] } },
    include: { destinationAccount: true, incomeSource: true },
    orderBy: { transactionDate: "desc" }
  });
  const realIncomeTransactions = transactions.filter((item) => !isOpeningBalanceTransaction(item));
  const totalUah = sumDecimals(realIncomeTransactions.filter((item) => item.currency === "UAH").map((item) => item.amount));
  const totalUsdt = sumDecimals(realIncomeTransactions.filter((item) => item.currency === "USDT").map((item) => item.amount));
  return (
    <AppShell>
      <BackToStatistics />
      <PageTitle title="Доходи" subtitle="Надходження за джерелами без подвійного врахування" />
      <MetricGrid items={[{ label: "UAH", value: formatMoney(totalUah, "UAH") }, { label: "USDT", value: formatMoney(totalUsdt, "USDT") }, { label: "Операцій", value: String(transactions.length) }]} />
      <div className="mt-5">
        <TransactionList items={transactions} />
      </div>
    </AppShell>
  );
}
