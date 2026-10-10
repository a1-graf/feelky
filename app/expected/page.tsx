import { freezeFromAccountAction } from "@/app/expected/actions";
import { BackToStatistics } from "@/components/back-to-statistics";
import { ExpectedMoneyList } from "@/components/expected-money-list";
import { MetricGrid } from "@/components/metric-grid";
import { PageTitle } from "@/components/page-title";
import { Card } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { formatMoney, sumDecimals } from "@/lib/money";
import { requireUserId } from "@/lib/session";

export default async function ExpectedPage() {
  const userId = await requireUserId();
  const [items, accounts] = await Promise.all([
    prisma.expectedMoney.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, include: { sourceAccount: { select: { name: true } } } }),
    prisma.account.findMany({ where: { userId, isActive: true, isReserved: false }, orderBy: [{ type: "asc" }, { createdAt: "asc" }] })
  ]);
  const active = items.filter((item) => ["EXPECTED", "NEED_TO_COLLECT", "IN_PROGRESS"].includes(item.status));
  return (
    <>
      <BackToStatistics />
      <PageTitle title="Заморожені бабки" subtitle="Назва допомагає тримати в голові, де лежать гроші і що треба забрати" />
      <MetricGrid items={[{ label: "Заморожено UAH", value: formatMoney(sumDecimals(active.filter((i) => i.currency === "UAH").map((i) => i.amount)), "UAH") }, { label: "Заморожено USDT", value: formatMoney(sumDecimals(active.filter((i) => i.currency === "USDT").map((i) => i.amount)), "USDT") }, { label: "Записів", value: String(items.length) }]} />
      <Card className="mt-5">
        <div className="mb-1 font-semibold">Заморозити з рахунку</div>
        <div className="mb-3 text-sm text-[hsl(var(--card-muted-foreground))]">Гроші зникнуть із вільних і стануть записом тут. Банк не зміниться, а розморожуються вони назад на той самий рахунок.</div>
        <form action={freezeFromAccountAction} className="grid gap-3 sm:grid-cols-[1.3fr_0.8fr_1fr_auto] sm:items-end">
          <label>Рахунок
            <select name="accountId" required>
              {accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {formatMoney(account.currentBalance, account.currency)}</option>)}
            </select>
          </label>
          <label>Сума<input name="amount" inputMode="decimal" placeholder="300" required /></label>
          <label>Що це<input name="title" placeholder="холд біржі" /></label>
          <button className="min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground" type="submit">Заморозити</button>
        </form>
      </Card>
      <div className="mt-5">
        <ExpectedMoneyList items={items.map((item) => ({
          id: item.id,
          title: item.title,
          amount: item.amount.toString(),
          currency: item.currency,
          status: item.status,
          note: item.note,
          sourceAccountName: item.sourceAccount?.name ?? null
        }))} />
      </div>
    </>
  );
}
