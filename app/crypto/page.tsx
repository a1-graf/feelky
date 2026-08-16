import { AccountType, FrozenFundStatus } from "@prisma/client";
import { BackToStatistics } from "@/components/back-to-statistics";
import { PageTitle } from "@/components/page-title";
import { Card } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { D, formatMoney } from "@/lib/money";
import { requireUserId } from "@/lib/session";

export default async function CryptoPage() {
  const userId = await requireUserId();
  const [accounts, frozen] = await Promise.all([
    prisma.account.findMany({
      where: { userId, isActive: true, type: { in: [AccountType.EXCHANGE, AccountType.EXCHANGE_SUBACCOUNT, AccountType.CRYPTO_WALLET] } },
      include: { childAccounts: true },
      orderBy: { createdAt: "asc" }
    }),
    prisma.frozenFund.findMany({ where: { userId, status: FrozenFundStatus.FROZEN } })
  ]);
  const frozenByAccount = new Map<string, string>();
  for (const fund of frozen) {
    frozenByAccount.set(fund.accountId, D(frozenByAccount.get(fund.accountId) || 0).plus(fund.amount).toString());
  }
  const total = accounts.reduce((sum, account) => sum.plus(account.currentBalance), D(0));
  return (
    <>
      <BackToStatistics />
      <PageTitle title="Мейн гаманець" subtitle={`Основні USDT в одному місці · баланс: ${formatMoney(total, "USDT")}`} />
      <div className="grid gap-3">
        {accounts.filter((account) => !account.parentAccountId).map((account) => {
          const frozenAmount = D(frozenByAccount.get(account.id) || 0);
          const available = D(account.currentBalance).minus(frozenAmount);
          return (
            <Card key={account.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{account.name}</div>
                  <div className="text-sm text-muted-foreground">оновлено {new Intl.DateTimeFormat("uk-UA").format(account.updatedAt)}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{formatMoney(account.currentBalance, account.currency)}</div>
                  <div className="text-sm text-muted-foreground">доступно {formatMoney(available, account.currency)} · заморожено {formatMoney(frozenAmount, account.currency)}</div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
