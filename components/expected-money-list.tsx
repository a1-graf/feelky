"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";

type ExpectedMoneyItem = {
  id: string;
  title: string;
  amount: string;
  currency: "UAH" | "USDT" | "USD";
  status: string;
  note: string | null;
};

const activeStatuses = new Set(["EXPECTED", "NEED_TO_COLLECT", "IN_PROGRESS"]);

export function ExpectedMoneyList({ items }: { items: ExpectedMoneyItem[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function release(formData: FormData) {
    setMessage("");
    const actualAmount = String(formData.get("actualAmount") || "").trim();
    const response = await fetch("/api/expected", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "releaseToMainWallet",
        expectedMoneyId: formData.get("expectedMoneyId"),
        actualAmount: actualAmount || undefined
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(data.error || "Не вдалося розморозити");
      return;
    }
    setMessage("Розморожено в мейн гаманець");
    router.refresh();
  }

  if (!items.length) {
    return <Card className="text-sm text-[hsl(var(--card-muted-foreground))]">Поки немає заморожених записів.</Card>;
  }

  return (
    <div className="grid gap-3">
      {message && <div className="rounded-lg bg-card p-3 text-sm text-[hsl(var(--card-foreground))]">{message}</div>}
      {items.map((item) => {
        const active = activeStatuses.has(item.status);
        return (
          <Card key={item.id}>
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <div className="font-medium">{item.title}</div>
                <div className="text-sm text-[hsl(var(--card-muted-foreground))]">{item.status}{item.note ? ` · ${item.note}` : ""}</div>
              </div>
              <div className="font-semibold">{formatMoney(item.amount, item.currency)}</div>
            </div>
            {active && (
              <form action={release} className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                <input type="hidden" name="expectedMoneyId" value={item.id} />
                <label>
                  Скільки зайшло в мейн гаманець USDT
                  <input name="actualAmount" inputMode="decimal" defaultValue={item.currency === "USDT" ? item.amount : ""} placeholder={item.currency === "USDT" ? undefined : "Фактична сума USDT"} />
                </label>
                <Button className="min-h-10">Розморозити</Button>
              </form>
            )}
          </Card>
        );
      })}
    </div>
  );
}
