import { ArchiveExplorer } from "@/components/archive-explorer";
import { BackToOverview } from "@/components/back-to-overview";
import { PageTitle } from "@/components/page-title";
import { Card } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";

export default async function ArchivePage() {
  const userId = await requireUserId();
  const transactions = await prisma.transaction.findMany({
    where: { userId, archivedAt: { not: null } },
    include: { sourceAccount: true, destinationAccount: true, category: true, incomeSource: true },
    orderBy: [{ archivedAt: "desc" }, { transactionDate: "desc" }]
  });
  const newest = transactions[0]?.archivedAt;
  return (
    <>
      <BackToOverview />
      <PageTitle title="Архів" subtitle="Архівовані операції не впливають на поточні баланси та можуть бути відновлені" />
      <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <Card className="p-4"><div className="text-xs text-[hsl(var(--card-muted-foreground))]">В архіві</div><div className="mt-1 text-xl font-bold">{transactions.length}</div></Card>
        <Card className="p-4"><div className="text-xs text-[hsl(var(--card-muted-foreground))]">Місяців</div><div className="mt-1 text-xl font-bold">{new Set(transactions.map((item) => item.archivedAt?.toISOString().slice(0, 7))).size}</div></Card>
        <Card className="col-span-2 p-4 sm:col-span-1"><div className="text-xs text-[hsl(var(--card-muted-foreground))]">Остання архівація</div><div className="mt-1 font-bold">{newest ? new Intl.DateTimeFormat("uk-UA").format(newest) : "—"}</div></Card>
      </div>
      <ArchiveExplorer items={transactions.map((item) => ({
        id: item.id,
        type: item.type,
        amount: item.amount.toString(),
        currency: item.currency,
        note: item.note,
        transactionDate: item.transactionDate.toISOString(),
        archivedAt: item.archivedAt!.toISOString(),
        source: item.sourceAccount?.name ?? null,
        destination: item.destinationAccount?.name ?? null,
        category: item.category?.name ?? null,
        incomeSource: item.incomeSource?.name ?? null
      }))} />
    </>
  );
}
