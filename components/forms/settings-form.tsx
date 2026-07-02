"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type SettingsPayload = {
  baseDisplayCurrency: string;
  rateMode: string;
  manualUahUsdtRate: string;
  greenMax: string;
  yellowMax: string;
  hideAmounts: boolean;
  theme: string;
};

export function SettingsForm({ settings }: { settings: SettingsPayload | null }) {
  const [message, setMessage] = useState("");

  async function submit(formData: FormData) {
    const body = Object.fromEntries(formData.entries());
    const response = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...body,
        hideAmounts: body.hideAmounts === "on"
      })
    });
    setMessage(response.ok ? "Налаштування збережено" : "Не вдалося зберегти");
    if (response.ok) setTimeout(() => window.location.reload(), 500);
  }

  return (
    <Card>
      <form action={submit} className="grid gap-3">
        <label>Базова валюта
          <select name="baseDisplayCurrency" defaultValue={settings?.baseDisplayCurrency || "USDT"}>
            <option>USDT</option>
            <option>UAH</option>
          </select>
        </label>
        <label>Режим курсу
          <select name="rateMode" defaultValue={settings?.rateMode || "P2P_AVERAGE"}>
            <option value="P2P_AVERAGE">Середній P2P</option>
            <option value="MANUAL">Ручний</option>
            <option value="AUTO">Авто provider</option>
          </select>
        </label>
        <label>Ручний курс UAH/USDT<input name="manualUahUsdtRate" inputMode="decimal" defaultValue={settings?.manualUahUsdtRate || ""} /></label>
        <div className="grid gap-2">
          <div className="text-sm text-muted-foreground">
            Пороги для кольорового статусу витрат: до зеленої межі показується зелений стан, до жовтої - попередження, вище - червоний.
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label>Зелена межа UAH<input name="greenMax" inputMode="decimal" defaultValue={settings?.greenMax || "20000"} /></label>
            <label>Жовта межа UAH<input name="yellowMax" inputMode="decimal" defaultValue={settings?.yellowMax || "40000"} /></label>
          </div>
        </div>
        <label>Тема
          <select name="theme" defaultValue={settings?.theme || "system"}>
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        <label className="flex flex-row items-center gap-2 text-foreground">
          <input className="h-5 w-5" type="checkbox" name="hideAmounts" defaultChecked={settings?.hideAmounts} />
          Приховувати суми
        </label>
        {message && <div className="rounded-lg bg-muted p-3 text-sm">{message}</div>}
        <Button>Зберегти</Button>
      </form>
    </Card>
  );
}
