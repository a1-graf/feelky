import { BackToStatistics } from "@/components/back-to-statistics";
import { AppShell } from "@/components/layout/app-shell";
import { PageTitle } from "@/components/page-title";
import { TransactionList } from "@/components/transaction-list";
import { Card } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { resolveUahUsdtRate } from "@/lib/dashboard";
import { formatMoney } from "@/lib/money";
import { requireUserId } from "@/lib/session";
import { SAVINGS_ACCOUNT_NAME } from "@/lib/user-defaults";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SavingsPage() {
  const userId = await requireUserId();
  const savingsAccount = await prisma.account.findFirst({
    where: { userId, name: SAVINGS_ACCOUNT_NAME, currency: "UAH", isActive: true }
  });
  const [transactions, rateData, settings] = await Promise.all([
    savingsAccount
      ? prisma.transaction.findMany({
          where: {
            userId,
            archivedAt: null,
            OR: [{ sourceAccountId: savingsAccount.id }, { destinationAccountId: savingsAccount.id }]
          },
          include: { sourceAccount: true, destinationAccount: true, category: true, incomeSource: true },
          orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }]
        })
      : Promise.resolve([]),
    resolveUahUsdtRate(userId),
    prisma.settings.findUnique({ where: { userId } })
  ]);
  const balance = savingsAccount?.currentBalance.toString() || "0";
  const balanceUsdt = Number(balance) / rateData.rate.toNumber();
  const hidden = Boolean(settings?.hideAmounts);

  return (
    <AppShell>
      <BackToStatistics />
      <PageTitle title="Відкладення" subtitle="Окремі накопичення в UAH, які входять у повний банк" />
      <Card className="mb-4 p-5 sm:p-6">
        <div className="text-sm text-[hsl(var(--card-muted-foreground))]">Накопичено</div>
        <div className="mt-2 text-3xl font-semibold text-success">{formatMoney(balance, "UAH", hidden)}</div>
        <div className="mt-2 text-sm font-medium text-[hsl(var(--card-muted-foreground))]">
          {formatMoney(balanceUsdt, "USDT", hidden)} за курсом {rateData.rate.toString()} UAH/USDT
        </div>
      </Card>
      <div className="mb-2 text-sm font-semibold text-muted-foreground">Історія відкладень</div>
      <TransactionList items={transactions} />
    </AppShell>
  );
}
