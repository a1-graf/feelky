"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/money";

type AccountBalanceItem = {
  id: string;
  name: string;
  type: string;
  currency: string;
  currentBalance: string;
  isActive: boolean;
};

export function AccountBalanceManager({ accounts }: { accounts: AccountBalanceItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState(accounts.filter((account) => account.isActive));
  const [pendingId, setPendingId] = useState("");
  const [message, setMessage] = useState("");

  function editBalance(id: string, currentBalance: string) {
    setItems((current) => current.map((account) => account.id === id ? { ...account, currentBalance } : account));
  }

  async function refreshAccounts() {
    const response = await fetch("/api/accounts", { cache: "no-store" });
    const data = (await response.json().catch(() => [])) as AccountBalanceItem[];
    if (!response.ok || !Array.isArray(data)) return;
    setItems(data.filter((account) => account.isActive).map((account) => ({
      id: account.id,
      name: account.name,
      type: account.type,
      currency: account.currency,
      currentBalance: account.currentBalance,
      isActive: account.isActive
    })));
  }

  async function submit(formData: FormData) {
    const accountId = String(formData.get("accountId") || "");
    const newBalance = String(formData.get("newBalance") || "").trim();
    const note = String(formData.get("note") || "").trim() || "Коригування балансу в налаштуваннях";
    if (!accountId || !newBalance) return;
    setPendingId(accountId);
    setMessage("");
    try {
      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ action: "manual", accountId, newBalance, note })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Не вдалося скоригувати баланс");
      setMessage("Баланс оновлено");
      await refreshAccounts();
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Помилка");
    } finally {
      setPendingId("");
    }
  }

  return (
    <Card className="lg:col-span-2">
      <div className="font-semibold">Актуальні баланси</div>
      <div className="mt-1 text-sm text-muted-foreground">Тут можна виставити правильний баланс будь-якого рахунку, якщо підрахунок став неправильним.</div>
      <div className="mt-4 grid gap-2">
        {items.map((account) => (
          <form key={account.id} action={submit} className="grid gap-2 rounded-lg border border-border bg-muted p-3 md:grid-cols-[1fr_180px_1fr_auto] md:items-end">
            <input type="hidden" name="accountId" value={account.id} />
            <div>
              <div className="font-semibold">{account.name}</div>
              <div className="text-sm text-muted-foreground">{account.type} · зараз {formatMoney(account.currentBalance, account.currency)}</div>
            </div>
            <label>
              Новий баланс
              <input
                name="newBalance"
                inputMode="decimal"
                value={account.currentBalance}
                onChange={(event) => editBalance(account.id, event.target.value)}
                required
              />
            </label>
            <label>
              Коментар
              <input name="note" placeholder="Чому міняєш" />
            </label>
            <Button className="min-h-10" disabled={pendingId === account.id}>
              {pendingId === account.id ? "Зберігаю..." : "Оновити"}
            </Button>
          </form>
        ))}
      </div>
      {message && <div className="mt-3 rounded-lg bg-muted p-3 text-sm">{message}</div>}
    </Card>
  );
}
