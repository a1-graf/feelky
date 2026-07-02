"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type RefKind = "category" | "incomeSource";

type RefItem = {
  id: string;
  name: string;
  isActive: boolean;
};

type ReferenceManagerProps = {
  title: string;
  addLabel: string;
  kind: RefKind;
  items: RefItem[];
};

export function ReferenceManager({ title, addLabel, kind, items }: ReferenceManagerProps) {
  const [message, setMessage] = useState("");
  const [newName, setNewName] = useState("");

  async function request(method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>) {
    setMessage("");
    const response = await fetch("/api/references", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Не вдалося зберегти");
    setMessage("Збережено");
    setTimeout(() => window.location.reload(), 350);
  }

  async function addItem(formData: FormData) {
    const name = String(formData.get("name") || "").trim();
    if (!name) return;
    await request("POST", { kind, name });
    setNewName("");
  }

  async function updateItem(formData: FormData) {
    const id = String(formData.get("id") || "");
    const intent = String(formData.get("intent") || "save");
    if (intent === "delete") {
      if (!id) return;
      await request("DELETE", { kind, id });
      return;
    }
    const name = String(formData.get("name") || "").trim();
    const isActive = formData.get("isActive") === "on";
    if (!id || !name) return;
    await request("PATCH", { kind, id, name, isActive });
  }

  return (
    <Card>
      <div className="mb-3 font-semibold">{title}</div>
      <div className="grid gap-2">
        {items.map((item) => (
          <form key={item.id} action={updateItem} className="grid gap-2 rounded-lg border border-border bg-muted p-2.5 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
            <input type="hidden" name="id" value={item.id} />
            <label>
              Назва
              <input name="name" defaultValue={item.name} required />
            </label>
            <label className="flex min-h-10 flex-row items-center gap-2 text-[hsl(var(--card-foreground))]">
              <input className="h-5 w-5" type="checkbox" name="isActive" defaultChecked={item.isActive} />
              Активне
            </label>
            <Button className="min-h-10" name="intent" value="save">Зберегти</Button>
            <Button className="min-h-10 bg-danger text-white hover:bg-danger/90" name="intent" value="delete">Видалити</Button>
          </form>
        ))}
      </div>
      <form action={addItem} className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
        <label>
          {addLabel}
          <input name="name" value={newName} onChange={(event) => setNewName(event.target.value)} required />
        </label>
        <Button className="min-h-10">Додати</Button>
      </form>
      {message && <div className="mt-3 rounded-lg bg-muted p-3 text-sm">{message}</div>}
    </Card>
  );
}
