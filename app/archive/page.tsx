import { PageTitle } from "@/components/page-title";
import { TransactionList } from "@/components/transaction-list";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";

export default async function ArchivePage() {
  const userId = await requireUserId();
  const transactions = await prisma.transaction.findMany({
    where: { userId, archivedAt: { not: null } },
    include: { sourceAccount: true, destinationAccount: true, category: true, incomeSource: true },
    orderBy: { archivedAt: "desc" }
  });
  return (
    <>
      <PageTitle title="Архів" subtitle="Архівовані операції не впливають на поточні баланси та можуть бути відновлені" />
      <TransactionList items={transactions} archiveMode />
    </>
  );
}
