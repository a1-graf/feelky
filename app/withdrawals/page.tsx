import { TransactionType } from "@prisma/client";
import { BackToStatistics } from "@/components/back-to-statistics";
import { MetricGrid } from "@/components/metric-grid";
import { PageTitle } from "@/components/page-title";
import { TransactionList } from "@/components/transaction-list";
import { prisma } from "@/lib/db";
import { formatMoney, sumDecimals } from "@/lib/money";
import { requireUserId } from "@/lib/session";

export default async function WithdrawalsPage() {
  const userId = await requireUserId();
  const transactions = await prisma.transaction.findMany({
    where: { userId, archivedAt: null, type: { in: [TransactionType.P2P_WITHDRAWAL, TransactionType.CASH_WITHDRAWAL] } },
    include: { sourceAccount: true, destinationAccount: true },
    orderBy: { transactionDate: "desc" }
  });
  const spent = sumDecimals(transactions.map((item) => item.amount));
  const receivedUah = sumDecimals(transactions.filter((item) => item.convertedCurrency === "UAH").map((item) => item.convertedAmount || 0));
  return (
    <>
      <BackToStatistics />
      <PageTitle title="Виводи" subtitle="P2P та готівкові виводи виконуються атомарно через LedgerService" />
      <MetricGrid items={[{ label: "Витрачено USDT", value: formatMoney(spent, "USDT") }, { label: "Отримано UAH", value: formatMoney(receivedUah, "UAH") }, { label: "Операцій", value: String(transactions.length) }]} />
      <div className="mt-5">
        <TransactionList items={transactions} />
      </div>
    </>
  );
}
