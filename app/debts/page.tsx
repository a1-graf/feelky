import { createDebtAction, deleteDebtAction, repayDebtAction } from "@/app/debts/actions";
import { ActionForm } from "@/components/action-form";
import { BackToOverview } from "@/components/back-to-overview";
import { NetCapitalCard } from "@/components/net-capital-card";
import { PageTitle } from "@/components/page-title";
import { Card } from "@/components/ui/card";
import { getDashboard } from "@/lib/dashboard";
import { prisma } from "@/lib/db";
import { listDebts, type DebtView } from "@/lib/debts";
import { D, formatMoney, formatPercent, formatPlain } from "@/lib/money";
import { requireUserId } from "@/lib/session";
import { kyivToday } from "@/lib/telegram/dates";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AccountOption = { id: string; name: string; currency: string; balance: string };

const dateFormat = new Intl.DateTimeFormat("uk-UA", { timeZone: "Europe/Kyiv", day: "2-digit", month: "2-digit", year: "numeric" });
const submitClass = "min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground";

function AccountSelect({ accounts, currency, name = "accountId", allowNone = false, preferred, hidden }: { accounts: AccountOption[]; currency?: string; name?: string; allowNone?: boolean; preferred?: string | null; hidden: boolean }) {
  const list = currency ? accounts.filter((account) => account.currency === currency) : accounts;
  const initial = allowNone ? "" : list.find((account) => account.id === preferred)?.id ?? list[0]?.id;
  return (
    <select name={name} defaultValue={initial} required={!allowNone}>
      {allowNone && <option value="">Без руху грошей (лише запис)</option>}
      {list.map((account) => (
        <option key={account.id} value={account.id}>
          {account.name} · {formatMoney(account.balance, account.currency, hidden)}
        </option>
      ))}
    </select>
  );
}

function DebtCard({ debt, accounts, hidden }: { debt: DebtView; accounts: AccountOption[]; hidden: boolean }) {
  const borrowed = debt.direction === "BORROWED";
  const progress = D(debt.amount).gt(0) ? D(debt.repaid).div(debt.amount).times(100).toNumber() : 0;
  const open = debt.status === "OPEN";
  return (
    <Card className="grid gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={`text-xs font-semibold ${borrowed ? "text-danger" : "text-success"}`}>{borrowed ? "Я винен" : "Мені винні"}</div>
          <div className="truncate text-lg font-bold">{debt.counterparty}</div>
          <div className="text-xs text-[hsl(var(--card-muted-foreground))]">
            з {dateFormat.format(debt.startedAt)}
            {debt.dueDate ? ` · до ${dateFormat.format(debt.dueDate)}` : ""}
            {debt.account ? ` · ${borrowed ? "на" : "з"} «${debt.account}»` : " · без руху грошей"}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-[hsl(var(--card-muted-foreground))]">{open ? "Лишилось" : "Закрито"}</div>
          <div className={`text-lg font-bold tabular-nums ${open ? (borrowed ? "text-danger" : "text-success") : ""}`}>{formatMoney(open ? debt.left : debt.amount, debt.currency, hidden)}</div>
          {open && debt.currency === "UAH" && <div className="text-xs text-[hsl(var(--card-muted-foreground))]">≈ {formatMoney(debt.leftUsdt, "USDT", hidden)}</div>}
        </div>
      </div>
      {debt.overdue && <div className="rounded-lg bg-danger/10 px-3 py-1.5 text-xs font-semibold text-danger">Термін минув</div>}
      <div>
        <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} /></div>
        <div className="mt-1 flex justify-between gap-2 text-xs text-[hsl(var(--card-muted-foreground))]">
          <span>Погашено {formatMoney(debt.repaid, debt.currency, hidden)} з {formatMoney(debt.amount, debt.currency, hidden)}</span>
          <span>{hidden ? "••••" : formatPercent(progress)}</span>
        </div>
      </div>
      {debt.note && <div className="text-sm text-[hsl(var(--card-muted-foreground))]">{debt.note}</div>}
      {debt.repayments.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-[hsl(var(--card-muted-foreground))]">Погашення ({debt.repayments.length})</summary>
          <ul className="mt-2 grid gap-1">
            {debt.repayments.map((item) => (
              <li key={item.id} className="flex justify-between gap-3 rounded-lg bg-muted/60 px-3 py-1.5">
                <span>{dateFormat.format(item.date)}{item.account ? ` · ${item.account}` : ""}</span>
                <span className="font-semibold tabular-nums">{formatMoney(item.amount, debt.currency, hidden)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      {open && (
        <ActionForm action={repayDebtAction} className="grid gap-2 border-t border-border pt-3 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end">
          <input type="hidden" name="debtId" value={debt.id} />
          <label>{borrowed ? "Віддаю" : "Повернули"}<input name="amount" inputMode="decimal" placeholder={`усе: ${formatPlain(debt.left)}`} /></label>
          <label>{borrowed ? "З рахунку" : "На рахунок"}<AccountSelect accounts={accounts} currency={debt.currency} preferred={debt.accountId} hidden={hidden} /></label>
          <button className={submitClass} type="submit">{borrowed ? "Погасити" : "Отримати"}</button>
        </ActionForm>
      )}
      <ActionForm action={deleteDebtAction} confirmText={`Видалити борг «${debt.counterparty}»? Усі його рухи грошей буде скасовано, баланси рахунків повернуться.`} className="flex justify-end">
        <input type="hidden" name="debtId" value={debt.id} />
        <button type="submit" className="text-xs font-medium text-[hsl(var(--card-muted-foreground))] underline-offset-2 hover:text-danger hover:underline">Видалити борг</button>
      </ActionForm>
    </Card>
  );
}

export default async function DebtsPage() {
  const userId = await requireUserId();
  const [dashboard, accounts] = await Promise.all([
    getDashboard(userId, { period: "month" }),
    prisma.account.findMany({ where: { userId, isActive: true }, orderBy: [{ type: "asc" }, { createdAt: "asc" }] })
  ]);
  const data = await listDebts(userId, dashboard.rate);
  const hidden = Boolean(dashboard.settings?.hideAmounts);
  const options: AccountOption[] = accounts.map((account) => ({ id: account.id, name: account.name, currency: account.currency, balance: account.currentBalance.toString() }));
  const open = data.debts.filter((debt) => debt.status === "OPEN");
  const closed = data.debts.filter((debt) => debt.status === "CLOSED");

  return (
    <>
      <BackToOverview />
      <PageTitle title="Борги" subtitle="Позики в обидва боки. Отримані чи віддані гроші за боргом — не дохід і не витрата" />
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="grid content-start gap-4">
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            <Card className="border-danger/30 bg-danger/10 p-4">
              <div className="text-xs font-medium text-danger">Я винен</div>
              <div className="mt-1 text-xl font-bold tabular-nums text-danger">{formatMoney(data.totals.owedUsdt, "USDT", hidden)}</div>
              {data.totals.byCurrency.filter((item) => D(item.owed).gt(0)).map((item) => <div key={item.currency} className="text-xs text-[hsl(var(--card-muted-foreground))]">{formatMoney(item.owed, item.currency, hidden)}</div>)}
            </Card>
            <Card className="border-success/30 bg-success/10 p-4">
              <div className="text-xs font-medium text-success">Мені винні</div>
              <div className="mt-1 text-xl font-bold tabular-nums text-success">{formatMoney(data.totals.owedToMeUsdt, "USDT", hidden)}</div>
              {data.totals.byCurrency.filter((item) => D(item.owedToMe).gt(0)).map((item) => <div key={item.currency} className="text-xs text-[hsl(var(--card-muted-foreground))]">{formatMoney(item.owedToMe, item.currency, hidden)}</div>)}
            </Card>
          </div>

          <Card>
            <div className="mb-1 font-semibold">Новий борг</div>
            <div className="mb-3 text-sm text-[hsl(var(--card-muted-foreground))]">Якщо обрати рахунок, гроші на ньому зміняться: узятий борг прийде на рахунок, виданий — піде з нього. Це не дохід і не витрата.</div>
            <ActionForm action={createDebtAction} className="grid gap-3 sm:grid-cols-2">
              <label>Що сталося
                <select name="direction" defaultValue="BORROWED">
                  <option value="BORROWED">Я взяв у борг</option>
                  <option value="LENT">Я дав у борг</option>
                </select>
              </label>
              <label>З ким<input name="counterparty" required maxLength={80} placeholder="Андрій" /></label>
              <label>Сума<input name="amount" inputMode="decimal" required placeholder="5 000,00" /></label>
              <label>Валюта
                <select name="currency" defaultValue="UAH"><option>UAH</option><option>USDT</option><option>USD</option></select>
              </label>
              <label className="sm:col-span-2">Рахунок (у валюті боргу)<AccountSelect accounts={options} allowNone hidden={hidden} /></label>
              <label>Дата<input type="date" name="date" defaultValue={kyivToday()} max={kyivToday()} /></label>
              <label>Повернути до (необовʼязково)<input type="date" name="dueDate" /></label>
              <label className="sm:col-span-2">Нотатка<input name="note" maxLength={200} placeholder="На що / умови" /></label>
              <button className={`${submitClass} sm:col-span-2`} type="submit">Записати борг</button>
            </ActionForm>
          </Card>

          <section className="grid gap-3">
            <div className="flex items-center justify-between"><h2 className="font-semibold">Відкриті</h2><span className="rounded-md bg-muted px-2 py-1 text-xs">{open.length}</span></div>
            {open.length ? open.map((debt) => <DebtCard key={debt.id} debt={debt} accounts={options} hidden={hidden} />) : <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Відкритих боргів немає</div>}
          </section>
          {closed.length > 0 && (
            <details className="grid gap-3">
              <summary className="cursor-pointer font-semibold">Закриті ({closed.length})</summary>
              <div className="mt-3 grid gap-3">{closed.map((debt) => <DebtCard key={debt.id} debt={debt} accounts={options} hidden={hidden} />)}</div>
            </details>
          )}
        </div>
        <div className="grid content-start gap-4">
          <NetCapitalCard totals={dashboard.totals} hidden={hidden} rate={dashboard.rate} />
          <Card className="text-sm text-[hsl(var(--card-muted-foreground))]">
            <div className="mb-1 font-semibold text-foreground">Як це рахується</div>
            Узятий борг додає гроші на рахунок, тож доступний і загальний банк ростуть, але «Чистий капітал» не змінюється: борг віднімається окремим рядком. Погашення зменшує і рахунок, і борг. Виданий борг навпаки: гроші пішли з рахунку, а сума «Мені винні» додається до чистого капіталу. Статистика доходів і витрат борги не бачить.
          </Card>
        </div>
      </div>
    </>
  );
}
