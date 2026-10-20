import { TransactionType } from "@prisma/client";
import { BackToOverview } from "@/components/back-to-overview";
import { MetricGrid } from "@/components/metric-grid";
import { PageTitle } from "@/components/page-title";
import { TransactionList } from "@/components/transaction-list";
import { prisma } from "@/lib/db";
import { formatMoney, sumDecimals } from "@/lib/money";
import { requireUserId } from "@/lib/session";

export default async function WithdrawalsPage() {
  const userId = await requireUserId();
  const transactions = await prisma.transaction.findMany({
    where: { userId, archivedAt: null, type: { in: [TransactionType.P2P_WITHDRAWAL, TransactionType.P2P_DEPOSIT, TransactionType.CASH_WITHDRAWAL] } },
    include: { sourceAccount: true, destinationAccount: true },
    orderBy: { transactionDate: "desc" }
  });
  const withdrawals = transactions.filter((item) => item.type !== TransactionType.P2P_DEPOSIT);
  const deposits = transactions.filter((item) => item.type === TransactionType.P2P_DEPOSIT);
  const spent = sumDecimals(withdrawals.map((item) => item.amount));
  const receivedUah = sumDecimals(withdrawals.filter((item) => item.convertedCurrency === "UAH").map((item) => item.convertedAmount || 0));
  const depositedUah = sumDecimals(deposits.map((item) => item.amount));
  const depositedUsdt = sumDecimals(deposits.map((item) => item.convertedAmount || 0));
  return (
    <>
      <BackToOverview />
      <PageTitle title="Виводи й заводи" subtitle="P2P та готівкові виводи, P2P-заводи назад на біржу" />
      <MetricGrid
        items={[
          { label: "Витрачено USDT", value: formatMoney(spent, "USDT"), subValue: `Виводів: ${withdrawals.length}` },
          { label: "Отримано UAH", value: formatMoney(receivedUah, "UAH") },
          { label: "Заведено UAH", value: formatMoney(depositedUah, "UAH"), subValue: `Заводів: ${deposits.length}` },
          { label: "Зайшло USDT", value: formatMoney(depositedUsdt, "USDT") }
        ]}
      />
      <div className="mt-5">
        <TransactionList items={transactions} />
      </div>
    </>
  );
}
