import { freezeFromAccountAction } from "@/app/expected/actions";
import { BackToOverview } from "@/components/back-to-overview";
import { ExpectedMoneyList } from "@/components/expected-money-list";
import { PageTitle } from "@/components/page-title";
import { Card } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { resolveUahUsdtRate } from "@/lib/dashboard";
import { D, formatMoney } from "@/lib/money";
import { requireUserId } from "@/lib/session";

const ACTIVE = new Set(["EXPECTED", "NEED_TO_COLLECT", "IN_PROGRESS"]);

export default async function ExpectedPage() {
  const userId = await requireUserId();
  const [items, accounts, rateData, settings] = await Promise.all([
    prisma.expectedMoney.findMany({ where: { userId }, orderBy: [{ createdAt: "desc" }], include: { sourceAccount: { select: { name: true } } } }),
    prisma.account.findMany({ where: { userId, isActive: true, isReserved: false }, orderBy: [{ type: "asc" }, { createdAt: "asc" }] }),
    resolveUahUsdtRate(userId),
    prisma.settings.findUnique({ where: { userId }, select: { hideAmounts: true } })
  ]);
  const active = items.filter((item) => ACTIVE.has(item.status));
  const resolved = items.filter((item) => !ACTIVE.has(item.status));
  const asUsdt = (amount: unknown, currency: string) => currency === "UAH" ? D(amount as string).div(rateData.rate) : D(amount as string);
  const frozenUsdt = active.reduce((sum, item) => sum.plus(asUsdt(item.amount, item.currency)), D(0));
  const own = active.filter((item) => item.sourceAccountId);
  const external = active.filter((item) => !item.sourceAccountId);
  const hidden = Boolean(settings?.hideAmounts);
  const serialise = (rows: typeof items) => rows.map((item) => ({
    id: item.id,
    title: item.title,
    amount: item.amount.toString(),
    currency: item.currency,
    status: item.status,
    note: item.note,
    sourceAccountName: item.sourceAccount?.name ?? null
  }));

  return (
    <>
      <BackToOverview />
      <PageTitle title="Заморожене" subtitle="Гроші поза вільним балансом: власні холди та суми, які мають повернутися" />
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
        <Card className="col-span-2 border-primary/30 bg-primary/10 p-4 sm:col-span-1">
          <div className="text-xs text-primary">Активно заморожено</div>
          <div className="mt-1 text-xl font-bold text-primary">{formatMoney(frozenUsdt, "USDT", hidden)}</div>
        </Card>
        <Card className="p-4"><div className="text-xs text-[hsl(var(--card-muted-foreground))]">Активних записів</div><div className="mt-1 text-xl font-bold">{active.length}</div></Card>
        <Card className="p-4"><div className="text-xs text-[hsl(var(--card-muted-foreground))]">Власні холди</div><div className="mt-1 text-xl font-bold">{own.length}</div></Card>
        <Card className="p-4"><div className="text-xs text-[hsl(var(--card-muted-foreground))]">Очікуємо ззовні</div><div className="mt-1 text-xl font-bold">{external.length}</div></Card>
      </div>

      <Card className="mt-4">
        <div className="mb-1 font-semibold">Заморозити з рахунку</div>
        <div className="mb-3 text-sm text-[hsl(var(--card-muted-foreground))]">Сума піде з доступних у заморожене, але повний банк не зміниться. Розмороження поверне її на той самий рахунок.</div>
        <form action={freezeFromAccountAction} className="grid gap-3 sm:grid-cols-[1.3fr_0.8fr_1fr_auto] sm:items-end">
          <label>Рахунок<select name="accountId" required>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {formatMoney(account.currentBalance, account.currency, hidden)}</option>)}</select></label>
          <label>Сума<input name="amount" inputMode="decimal" placeholder="300,00" required /></label>
          <label>Що це<input name="title" placeholder="Холд біржі" /></label>
          <button className="min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground" type="submit">Заморозити</button>
        </form>
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <section>
          <div className="mb-2 flex items-center justify-between"><h2 className="font-semibold">Активні</h2><span className="rounded-md bg-muted px-2 py-1 text-xs">{active.length}</span></div>
          <ExpectedMoneyList items={serialise(active)} hidden={hidden} />
        </section>
        <section>
          <div className="mb-2 flex items-center justify-between"><h2 className="font-semibold">Завершені</h2><span className="rounded-md bg-muted px-2 py-1 text-xs">{resolved.length}</span></div>
          <ExpectedMoneyList items={serialise(resolved)} hidden={hidden} />
        </section>
      </div>
    </>
  );
}
