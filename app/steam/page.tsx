import Link from "next/link";
import { SteamArbitrageResidualStatus, SteamArbitrageRoundStatus, SteamResaleInvestmentStatus } from "@prisma/client";
import { AppShell } from "@/components/layout/app-shell";
import { MetricGrid } from "@/components/metric-grid";
import { PageTitle } from "@/components/page-title";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/money";
import { requireUserId } from "@/lib/session";
import { steamAnalytics } from "@/lib/steam";
import {
  addSteamResaleInvestmentAmountAction,
  completeSteamRoundAction,
  createSteamResaleAccountAction,
  createSteamResaleInvestmentAction,
  createSteamResaleWithdrawalAction,
  createSteamRoundAction,
  createSteamSchemeAction,
  createSteamSnapshotAction,
  undoLastSteamResaleAction,
  updateSteamResaleInvestmentReceivedAction
} from "@/app/steam/actions";

function dateInput(value = new Date()) {
  return value.toISOString().slice(0, 10);
}

function firstDayOfMonth() {
  const date = new Date();
  date.setDate(1);
  return dateInput(date);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label>{label}{children}</label>;
}

function Submit({ children }: { children: React.ReactNode }) {
  return <button className="min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground" type="submit">{children}</button>;
}

function formatDollarBadge(value: string) {
  return `$${Number(value).toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 0 })}`;
}

function bonusLabel(externalAmount: unknown, receivedSteamAmount: unknown) {
  const external = Number(externalAmount || 0);
  const received = Number(receivedSteamAmount || 0);
  if (!external || !received) return "очікує доповнення";
  const bonus = received - external;
  const percent = (bonus / external) * 100;
  return `${bonus >= 0 ? "+" : ""}${bonus.toFixed(2)} USDT · ${percent >= 0 ? "+" : ""}${percent.toFixed(1)}%`;
}

export default async function SteamPage({ searchParams }: { searchParams?: Promise<{ tab?: string }> }) {
  const userId = await requireUserId();
  const params = await searchParams;
  const tab = params?.tab === "arbitrage" ? "arbitrage" : "resale";
  const data = await steamAnalytics.dashboard(userId);
  const accounts = data.accounts;
  const resaleAccounts = data.resaleAccounts;
  const schemes = data.schemes;
  const activeResaleInvestments = data.resaleInvestments.filter((item) => item.status === SteamResaleInvestmentStatus.ACTIVE);
  const activeRounds = data.rounds.filter((round) => round.status === SteamArbitrageRoundStatus.ACTIVE);
  const completedRounds = data.rounds.filter((round) => round.status === SteamArbitrageRoundStatus.COMPLETED);
  const openResiduals = data.residuals.filter((item) => item.status === SteamArbitrageResidualStatus.OPEN);
  const defaultResaleAccount = resaleAccounts[0]?.id || "";
  const defaultAccount = accounts.find((account) => account.name === "Мейн гаманець")?.id || accounts[0]?.id || "";
  const defaultScheme = schemes[0]?.id || "";

  return (
    <AppShell>
      <PageTitle title="Steam" subtitle="Перепродаж, арбітраж і Steam-капітал без змішування із software balance" />
      <div className="mb-4 grid gap-3 lg:grid-cols-2">
        <Card className="border-primary/40 bg-[hsl(var(--card))]">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="font-semibold">Перепродаж крутиться</div>
            <div className="rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">{formatDollarBadge(data.totals.activeResaleCapital)}</div>
          </div>
          {activeResaleInvestments.length ? (
            <div className="grid gap-2">
              {activeResaleInvestments.slice(0, 3).map((item) => (
                <div key={item.id} className="grid gap-1 rounded-md border border-border bg-[hsl(var(--muted))] p-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium">{new Intl.DateTimeFormat("uk-UA").format(item.startedAt)}</span>
                    <span className="text-sm font-semibold">{formatMoney(item.externalAmount.toString(), "USDT")}</span>
                  </div>
                  <div className="text-xs text-[hsl(var(--card-muted-foreground))]">
                    У Steam/софті: {formatMoney(item.receivedSteamAmount.toString(), "USDT")}
                  </div>
                  <div className="text-xs font-semibold text-success">{bonusLabel(item.externalAmount, item.receivedSteamAmount)}</div>
                </div>
              ))}
              {activeResaleInvestments.length > 3 ? <div className="text-xs text-[hsl(var(--card-muted-foreground))]">Ще {activeResaleInvestments.length - 3} активних вкладень нижче</div> : null}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-border p-3 text-sm text-[hsl(var(--card-muted-foreground))]">Активної перепродажі ще немає.</div>
          )}
        </Card>

        <Card className="border-primary/40 bg-[hsl(var(--card))]">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="font-semibold">Активні круги</div>
            <div className="rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">{formatDollarBadge(data.totals.activeArbitrageCapital)}</div>
          </div>
          {activeRounds.length ? (
            <div className="grid gap-2">
              {activeRounds.slice(0, 3).map((round) => (
                <div key={round.id} className="grid gap-1 rounded-md border border-border bg-[hsl(var(--muted))] p-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-sm font-medium">{round.scheme.name}{round.siteName ? ` · ${round.siteName}` : ""}</span>
                    <span className="shrink-0 text-sm font-semibold">{formatMoney(round.investedAmount.toString(), "USDT")}</span>
                  </div>
                  <div className="text-xs text-[hsl(var(--card-muted-foreground))]">
                    Старт: {new Intl.DateTimeFormat("uk-UA").format(round.startedAt)}
                  </div>
                </div>
              ))}
              {activeRounds.length > 3 ? <div className="text-xs text-[hsl(var(--card-muted-foreground))]">Ще {activeRounds.length - 3} активних кругів нижче</div> : null}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-border p-3 text-sm text-[hsl(var(--card-muted-foreground))]">Активних кругів ще немає.</div>
          )}
        </Card>
      </div>
      <MetricGrid
        items={[
          { label: "Заморожено в Steam", value: formatMoney(data.totals.frozenCapital, "USDT"), tone: "warn" },
          { label: "Баланс перепродажу в софті", value: formatMoney(data.totals.softwareBalance, "USDT") },
          { label: "Перепродаж в обороті", value: formatMoney(data.totals.activeResaleCapital, "USDT") },
          { label: "Активні круги", value: String(data.totals.activeRounds) },
          { label: "Невиведені залишки", value: formatMoney(data.totals.openResidualCapital, "USDT") },
          { label: "Виведено чистими", value: formatMoney(data.totals.withdrawnClean, "USDT"), tone: "ok" },
          { label: "Steam прибуток", value: formatMoney(data.totals.steamProfit, "USDT"), tone: "ok" },
          { label: "Steam витрати", value: formatMoney(data.totals.steamExpenses, "USDT"), tone: "danger" },
          { label: "Середній ROI", value: `${Number(data.totals.avgRoi).toFixed(1)}%` },
          { label: "Середня тривалість", value: `${data.totals.avgDurationDays} дн.` }
        ]}
      />

      <div className="mt-4 grid grid-cols-2 overflow-hidden rounded-lg border border-border bg-card p-1 text-sm font-semibold">
        <Link href="/steam?tab=resale" className={`rounded-md px-3 py-2 text-center ${tab === "resale" ? "bg-primary text-primary-foreground" : "text-[hsl(var(--card-muted-foreground))]"}`}>Перепродаж</Link>
        <Link href="/steam?tab=arbitrage" className={`rounded-md px-3 py-2 text-center ${tab === "arbitrage" ? "bg-primary text-primary-foreground" : "text-[hsl(var(--card-muted-foreground))]"}`}>Арбітраж</Link>
      </div>

      {tab === "resale" ? (
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <Card className="xl:col-span-2">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <div className="font-semibold">Відкат останньої дії перепродажу</div>
                <div className="text-sm text-[hsl(var(--card-muted-foreground))]">
                  Повертає останнє створення завозу, доповнення завозу або зміну поля “зайшло в софт”.
                </div>
              </div>
              <form action={undoLastSteamResaleAction}>
                <button className="min-h-11 rounded-lg border border-danger/50 px-4 py-2 text-sm font-semibold text-danger" type="submit">
                  Відкотити останню дію
                </button>
              </form>
            </div>
          </Card>

          <Card>
            <div className="mb-3 font-semibold">Акаунти перепродажу</div>
            {resaleAccounts.length ? (
              <div className="grid gap-2">
                {resaleAccounts.map((account) => (
                  <div key={account.id} className="flex items-center justify-between border-b border-border py-2 last:border-b-0">
                    <span>{account.name}</span>
                    <span className="font-semibold">{formatMoney(account.currentSoftwareBalance.toString(), account.currency)}</span>
                  </div>
                ))}
              </div>
            ) : <div className="text-sm text-[hsl(var(--card-muted-foreground))]">Створи перший акаунт перепродажу.</div>}
            <form action={createSteamResaleAccountAction} className="mt-4 grid gap-3">
              <Field label="Назва"><input name="name" placeholder="Steam resale" required /></Field>
              <Field label="Поточний баланс у софті"><input name="currentSoftwareBalance" inputMode="decimal" placeholder="0" /></Field>
              <Field label="Примітка"><input name="note" /></Field>
              <Submit>Додати акаунт</Submit>
            </form>
          </Card>

          <Card>
            <div className="mb-3 font-semibold">Steam snapshot</div>
            <form action={createSteamSnapshotAction} className="grid gap-3">
              <Field label="Акаунт">
                <select name="resaleAccountId" defaultValue={defaultResaleAccount} required>
                  {resaleAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                </select>
              </Field>
              <Field label="Баланс"><input name="balance" inputMode="decimal" required /></Field>
              <Field label="Дата"><input name="snapshotDate" type="date" defaultValue={firstDayOfMonth()} required /></Field>
              <Field label="Примітка"><input name="note" /></Field>
              <Submit>Зафіксувати баланс</Submit>
            </form>
          </Card>

          <Card>
            <div className="mb-3 font-semibold">Зовнішнє вкладення</div>
            <form action={createSteamResaleInvestmentAction} className="grid gap-3">
              <Field label="Акаунт перепродажу">
                <select name="resaleAccountId" defaultValue={defaultResaleAccount} required>
                  {resaleAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                </select>
              </Field>
              <Field label="Мейн гаманець">
                <select name="sourceAccountId" defaultValue={defaultAccount} required>
                  {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                </select>
              </Field>
              <Field label="Скільки вкинув"><input name="externalAmount" inputMode="decimal" required /></Field>
              <Field label="Скільки зайшло в Steam/софт"><input name="receivedSteamAmount" inputMode="decimal" placeholder="можна доповнити потім" /></Field>
              <Field label="Дата старту"><input name="startedAt" type="date" defaultValue={dateInput()} required /></Field>
              <Field label="Примітка"><input name="note" /></Field>
              <Submit>Створити вкладення</Submit>
            </form>
          </Card>

          <Card>
            <div className="mb-3 font-semibold">Вивід із перепродажу</div>
            <form action={createSteamResaleWithdrawalAction} className="grid gap-3">
              <Field label="Акаунт перепродажу">
                <select name="resaleAccountId" defaultValue={defaultResaleAccount} required>
                  {resaleAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                </select>
              </Field>
              <Field label="Куди отримано">
                <select name="destinationAccountId" defaultValue={defaultAccount} required>
                  {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                </select>
              </Field>
              <Field label="Списано із софту"><input name="softwareAmountSpent" inputMode="decimal" required /></Field>
              <Field label="Отримано чистими"><input name="amountReceived" inputMode="decimal" required /></Field>
              <Field label="Дата"><input name="withdrawalDate" type="date" defaultValue={dateInput()} required /></Field>
              <Submit>Створити вивід</Submit>
            </form>
          </Card>

          <Card className="xl:col-span-2">
            <div className="mb-3 font-semibold">Активні вкладення перепродажу</div>
            <div className="grid gap-2">
              {data.resaleInvestments.filter((item) => item.status === SteamResaleInvestmentStatus.ACTIVE).map((item) => (
                <div key={item.id} className="grid gap-3 border-b border-border py-3 last:border-b-0 xl:grid-cols-[1fr_360px_420px] xl:items-end">
                  <div className="grid gap-1 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                    <span>{new Intl.DateTimeFormat("uk-UA").format(item.startedAt)}</span>
                    <span>{formatMoney(item.externalAmount.toString(), "USDT")}</span>
                    <span className="text-sm text-[hsl(var(--card-muted-foreground))]">
                      Steam: {formatMoney(item.receivedSteamAmount.toString(), "USDT")} · <b className="text-success">{bonusLabel(item.externalAmount, item.receivedSteamAmount)}</b>
                    </span>
                  </div>
                  <form action={addSteamResaleInvestmentAmountAction} className="grid gap-2 sm:grid-cols-[1fr_120px_auto] sm:items-end">
                    <input type="hidden" name="investmentId" value={item.id} />
                    <Field label="+ до завозу">
                      <input name="extraExternalAmount" inputMode="decimal" placeholder="200" required />
                    </Field>
                    <Field label="Звідки">
                      <select name="sourceAccountId" defaultValue={defaultAccount} required>
                        {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                      </select>
                    </Field>
                    <button className="min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground" type="submit">Додати</button>
                  </form>
                  <form action={updateSteamResaleInvestmentReceivedAction} className="grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-end">
                    <input type="hidden" name="investmentId" value={item.id} />
                    <Field label="Зайшло в софт">
                      <input name="receivedSteamAmount" inputMode="decimal" defaultValue={item.receivedSteamAmount.toString()} required />
                    </Field>
                    <input type="hidden" name="completedAt" value={dateInput()} />
                    <button className="min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground" type="submit">Оновити</button>
                  </form>
                </div>
              ))}
            </div>
          </Card>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <Card>
            <div className="mb-3 font-semibold">Новий арбітражний круг</div>
            <form action={createSteamRoundAction} className="grid gap-3">
              <Field label="Схема">
                <select name="schemeId" defaultValue={defaultScheme} required>
                  {schemes.map((scheme) => <option key={scheme.id} value={scheme.id}>{scheme.name}</option>)}
                </select>
              </Field>
              <Field label="Сайт"><input name="siteName" placeholder="optional" /></Field>
              <Field label="Мейн гаманець">
                <select name="sourceAccountId" defaultValue={defaultAccount} required>
                  {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                </select>
              </Field>
              <Field label="Вкладено"><input name="investedAmount" inputMode="decimal" required /></Field>
              <Field label="Дата старту"><input name="startedAt" type="date" defaultValue={dateInput()} required /></Field>
              <Submit>Створити круг</Submit>
            </form>
          </Card>

          <Card>
            <div className="mb-3 font-semibold">Завершити круг</div>
            <form action={completeSteamRoundAction} className="grid gap-3">
              <Field label="Активний круг">
                <select name="roundId" required>
                  {activeRounds.map((round) => <option key={round.id} value={round.id}>{round.scheme.name} · {formatMoney(round.investedAmount.toString(), "USDT")}</option>)}
                </select>
              </Field>
              <Field label="Куди отримано">
                <select name="destinationAccountId" defaultValue={defaultAccount} required>
                  {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                </select>
              </Field>
              <Field label="Фінально отримано"><input name="finalAmountReceived" inputMode="decimal" required /></Field>
              <Field label="Невиведений залишок"><input name="remainingAmount" inputMode="decimal" placeholder="0" /></Field>
              <Field label="Дата завершення"><input name="completedAt" type="date" defaultValue={dateInput()} required /></Field>
              <Submit>Завершити</Submit>
            </form>
          </Card>

          <Card>
            <div className="mb-3 font-semibold">Схеми</div>
            <div className="grid gap-2 text-sm">
              {schemes.map((scheme) => <div key={scheme.id} className="border-b border-border py-2 last:border-b-0">{scheme.name}</div>)}
            </div>
            <form action={createSteamSchemeAction} className="mt-4 grid gap-3">
              <Field label="Нова схема"><input name="name" required /></Field>
              <Submit>Додати схему</Submit>
            </form>
          </Card>

          <Card>
            <div className="mb-3 font-semibold">Активні круги</div>
            <div className="grid gap-2">
              {activeRounds.map((round) => (
                <div key={round.id} className="grid gap-1 border-b border-border py-2 last:border-b-0">
                  <div className="font-medium">{round.scheme.name}{round.siteName ? ` · ${round.siteName}` : ""}</div>
                  <div className="text-sm text-[hsl(var(--card-muted-foreground))]">{formatMoney(round.investedAmount.toString(), "USDT")} · {new Intl.DateTimeFormat("uk-UA").format(round.startedAt)}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="xl:col-span-2">
            <div className="mb-3 font-semibold">Завершені круги та залишки</div>
            <div className="grid gap-2">
              {completedRounds.map((round) => (
                <div key={round.id} className="grid gap-1 border-b border-border py-2 last:border-b-0 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                  <span>{round.scheme.name}{round.siteName ? ` · ${round.siteName}` : ""}</span>
                  <span>{formatMoney(round.finalAmountReceived?.toString() || "0", "USDT")}</span>
                  <span className="text-sm text-[hsl(var(--card-muted-foreground))]">ROI {Number((Number(round.finalAmountReceived || 0) - Number(round.investedAmount)) / Number(round.investedAmount || 1) * 100).toFixed(1)}%</span>
                </div>
              ))}
              {openResiduals.map((residual) => (
                <div key={residual.id} className="text-sm text-warning">OPEN залишок: {formatMoney(residual.amount.toString(), "USDT")}</div>
              ))}
            </div>
          </Card>
        </div>
      )}

    </AppShell>
  );
}
