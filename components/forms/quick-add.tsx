"use client";

import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type AccountOption = {
  id: string;
  name: string;
  type: string;
  currency: string;
  currentBalance: string;
};

type RefOption = { id: string; name: string };

type Props = {
  accounts: AccountOption[];
  categories: RefOption[];
  incomeSources: RefOption[];
  settings: {
    p2pSourceAccountId: string | null;
    p2pDestinationAccountId: string | null;
    expenseDefaultSourceId: string | null;
    cashExchangePlace: string;
  } | null;
};

const today = () => {
  const date = new Date();
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 10);
};

const actionOptions = [
  { value: "withdrawal", label: "Вивід" },
  { value: "income", label: "Дохід" },
  { value: "expense", label: "Витрата" },
  { value: "flip", label: "Фліп" },
  { value: "expected", label: "Заморожені бабки" }
];

export function QuickAdd({ accounts, categories, incomeSources, settings }: Props) {
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState("withdrawal");
  const [withdrawalMode, setWithdrawalMode] = useState<"p2p" | "cash">("p2p");
  const [incomeCurrency, setIncomeCurrency] = useState("UAH");
  const [selectedExpenseSourceId, setSelectedExpenseSourceId] = useState(settings?.expenseDefaultSourceId || "");
  const [selectedCategoryId, setSelectedCategoryId] = useState(categories[0]?.id || "");
  const [steamExpenseMode, setSteamExpenseMode] = useState<"split" | "resale" | "arbitrage">("split");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const uahAccounts = accounts.filter((account) => account.currency === "UAH");
  const usdtAccounts = accounts.filter((account) => account.currency === "USDT");
  const cashAccounts = accounts.filter((account) => account.type === "CASH");
  const defaultCard = settings?.p2pDestinationAccountId || uahAccounts[0]?.id || "";
  const defaultExpense = settings?.expenseDefaultSourceId || defaultCard;
  const defaultSteamExpense = usdtAccounts.find((account) => account.name === "Мейн гаманець")?.id || usdtAccounts[0]?.id || "";
  const defaultIncomeSource = incomeSources[0]?.id || "";
  const defaultCategory = categories[0]?.id || "";
  const steamCategoryId = categories.find((category) => category.name.toLowerCase() === "steam")?.id || "";
  const isSteamExpense = action === "expense" && selectedCategoryId === steamCategoryId;
  const expenseSourceAccounts = accounts.filter((account) => account.currency === "UAH" || account.currency === "USDT");
  const selectedExpenseSource =
    expenseSourceAccounts.find((account) => account.id === selectedExpenseSourceId) ||
    expenseSourceAccounts.find((account) => account.id === defaultExpense) ||
    expenseSourceAccounts[0];
  const expenseCurrency = isSteamExpense ? "USDT" : selectedExpenseSource?.currency === "USDT" ? "USDT" : "UAH";
  const incomeDestinationAccounts = accounts.filter((account) => account.currency === incomeCurrency);
  const defaultIncomeDestination = incomeDestinationAccounts[0]?.id || "";
  const cashTarget = useMemo(() => {
    return (currency: string) => cashAccounts.find((account) => account.currency === currency)?.id || "";
  }, [cashAccounts]);

  async function submit(formData: FormData) {
    setLoading(true);
    setMessage("");
    const body = Object.fromEntries(formData.entries());
    body.action = action === "withdrawal" ? withdrawalMode : action;
    if (isSteamExpense) {
      body.action = "expenseWithAllocation";
      body.resalePercent = steamExpenseMode === "arbitrage" ? "0" : steamExpenseMode === "resale" ? "100" : "50";
      body.arbitragePercent = steamExpenseMode === "resale" ? "0" : steamExpenseMode === "arbitrage" ? "100" : "50";
    }
    try {
      const url = isSteamExpense ? "/api/steam" : action === "expected" ? "/api/expected" : action === "flip" ? "/api/flips" : "/api/transactions";
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Помилка збереження");
      setMessage("Збережено");
      setTimeout(() => window.location.reload(), 450);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Помилка");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        className="fixed bottom-24 right-4 z-50 inline-flex h-14 items-center gap-2 rounded-full bg-primary px-5 font-semibold text-primary-foreground shadow-soft md:bottom-6"
        onClick={() => setOpen(true)}
      >
        <Plus className="h-5 w-5" />
        Додати
      </button>
      {open && (
        <div className="fixed inset-0 z-50 grid items-end bg-black/30 md:place-items-center">
          <div className="max-h-[90vh] w-full overflow-auto rounded-t-xl border border-border bg-card p-3 shadow-soft md:max-w-md md:rounded-lg md:p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Швидке додавання</h2>
                <p className="text-sm text-muted-foreground">Дата за замовчуванням сьогодні</p>
              </div>
              <Button variant="ghost" className="min-h-9 px-2" onClick={() => setOpen(false)} aria-label="Закрити">
                <X className="h-5 w-5" />
              </Button>
            </div>
            <form action={submit} className="grid gap-2.5 [&_input]:min-h-10 [&_input]:py-2 [&_select]:min-h-10 [&_select]:py-2 [&_textarea]:py-2">
              <label>
                Тип операції
                <select value={action} onChange={(event) => setAction(event.target.value)}>
                  {actionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              {action === "withdrawal" && (
                <>
                  <label>
                    Формат виводу
                    <select value={withdrawalMode} onChange={(event) => setWithdrawalMode(event.target.value as "p2p" | "cash")}>
                      <option value="p2p">P2P</option>
                      <option value="cash">Готівка</option>
                    </select>
                  </label>
                  {withdrawalMode === "p2p" ? (
                    <>
                      <label>Отримано UAH<input name="receivedUah" inputMode="decimal" required /></label>
                      <label>Курс UAH/USDT<input name="rateUahPerUsdt" inputMode="decimal" required /></label>
                      <DateField />
                    </>
                  ) : (
                    <>
                      <label>Отримана сума<input name="receivedAmount" inputMode="decimal" required /></label>
                      <label>Валюта<select name="receivedCurrency" defaultValue="UAH"><option>UAH</option><option>USD</option></select></label>
                      <label>Курс<input name="rate" inputMode="decimal" required /></label>
                      <DateField />
                      <label>Місце обміну<input name="exchangePlace" defaultValue={settings?.cashExchangePlace || "Cashalot"} /></label>
                      <input type="hidden" name="destinationAccountId" value={cashTarget("UAH")} />
                    </>
                  )}
                </>
              )}
              {action === "income" && (
                <>
                  <div className="grid grid-cols-[1fr_120px] gap-2">
                    <label>Сума<input name="amount" inputMode="decimal" required /></label>
                    <label>
                      Валюта
                      <select name="currency" value={incomeCurrency} onChange={(event) => setIncomeCurrency(event.target.value)}>
                        <option>UAH</option>
                        <option>USDT</option>
                      </select>
                    </label>
                  </div>
                  <DateField />
                  <Select name="incomeSourceId" label="Джерело" options={incomeSources} defaultValue={defaultIncomeSource} />
                  <Select key={incomeCurrency} name="destinationAccountId" label="Куди зарахувати" options={incomeDestinationAccounts} defaultValue={defaultIncomeDestination} />
                </>
              )}
              {action === "flip" && (
                <>
                  <label>Сетап<input name="setup" required placeholder="Наприклад: funding, news, spread" /></label>
                  <label>PnL USDT<input name="pnl" inputMode="decimal" required placeholder="40 або -40" /></label>
                  <DateField name="tradeDate" />
                </>
              )}
              {action === "expense" && (
                <>
                  {isSteamExpense ? (
                    <>
                      <label>Сума USDT<input name="amount" inputMode="decimal" required /></label>
                      <input type="hidden" name="currency" value="USDT" />
                    </>
                  ) : (
                    <>
                      <label>Сума {expenseCurrency}<input name="amount" inputMode="decimal" required /></label>
                      <input type="hidden" name="currency" value={expenseCurrency} />
                    </>
                  )}
                  <DateField />
                  <label>
                    Категорія
                    <select name="categoryId" value={selectedCategoryId || defaultCategory} onChange={(event) => setSelectedCategoryId(event.target.value)} required>
                      {categories.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
                    </select>
                  </label>
                  {isSteamExpense ? (
                    <Select name="sourceAccountId" label="Звідки списати" options={usdtAccounts} defaultValue={defaultSteamExpense} />
                  ) : (
                    <label>
                      Звідки списати
                      <select name="sourceAccountId" value={selectedExpenseSource?.id || ""} onChange={(event) => setSelectedExpenseSourceId(event.target.value)} required>
                        {expenseSourceAccounts.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
                      </select>
                    </label>
                  )}
                  {isSteamExpense && (
                    <label>
                      Куди віднести
                      <select value={steamExpenseMode} onChange={(event) => setSteamExpenseMode(event.target.value as "split" | "resale" | "arbitrage")}>
                        <option value="split">50/50 перепродаж + арбітраж</option>
                        <option value="resale">Тільки перепродаж</option>
                        <option value="arbitrage">Тільки арбітраж</option>
                      </select>
                    </label>
                  )}
                </>
              )}
              {action === "expected" && (
                <>
                  <label>Назва / де лежить<input name="title" required placeholder="Наприклад: Bybit, P2P, борг, сайт" /></label>
                  <MoneyFields currencies={["UAH", "USDT", "USD"]} />
                  <label>Статус<select name="status" defaultValue="EXPECTED"><option value="EXPECTED">Заморожено</option><option value="NEED_TO_COLLECT">Потрібно забрати</option><option value="IN_PROGRESS">В процесі</option></select></label>
                  <label>Контрольна дата<input name="expectedDate" type="date" /></label>
                </>
              )}
              <details className="rounded-lg border border-border p-2.5">
                <summary className="cursor-pointer text-sm text-muted-foreground">Додатково</summary>
                <label className="mt-3">Примітка<textarea name="note" rows={3} /></label>
              </details>
              {message && <div className="rounded-lg bg-muted p-3 text-sm">{message}</div>}
              <Button className="mt-1" disabled={loading}>{loading ? "Збереження..." : "Зберегти"}</Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function DateField({ name = "transactionDate" }: { name?: string }) {
  return <label>Дата<input name={name} type="date" defaultValue={today()} /></label>;
}

function MoneyFields({ currencies }: { currencies: string[] }) {
  return (
    <div className="grid grid-cols-[1fr_120px] gap-2">
      <label>Сума<input name="amount" inputMode="decimal" required /></label>
      <label>Валюта<select name="currency">{currencies.map((currency) => <option key={currency}>{currency}</option>)}</select></label>
    </div>
  );
}

function Select({ name, label, options, defaultValue }: { name: string; label: string; options: RefOption[]; defaultValue?: string }) {
  return (
    <label>
      {label}
      <select name={name} defaultValue={defaultValue} required>
        {options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
      </select>
    </label>
  );
}
