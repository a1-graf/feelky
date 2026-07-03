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
  const [visibleItems, setVisibleItems] = useState(items);
  const [pendingKey, setPendingKey] = useState("");

  function publishItems(nextItems: RefItem[]) {
    setVisibleItems(nextItems);
    window.dispatchEvent(new CustomEvent("feelky:references-changed", { detail: { kind, items: nextItems } }));
  }

  async function request<T>(method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>) {
    setMessage("");
    const response = await fetch("/api/references", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Не вдалося зберегти");
    setMessage("Збережено");
    return data as T;
  }

  async function addItem(formData: FormData) {
    const name = String(formData.get("name") || "").trim();
    if (!name) return;
    setPendingKey("add");
    try {
      const item = await request<RefItem>("POST", { kind, name });
      publishItems([...visibleItems.filter((current) => current.id !== item.id), item]);
      setNewName("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Помилка");
    } finally {
      setPendingKey("");
    }
  }

  async function updateItem(formData: FormData) {
    const id = String(formData.get("id") || "");
    const name = String(formData.get("name") || "").trim();
    const isActive = formData.get("isActive") === "on";
    if (!id || !name) return;
    setPendingKey(`save:${id}`);
    try {
      const item = await request<RefItem>("PATCH", { kind, id, name, isActive });
      const nextItems = isActive
        ? visibleItems.map((current) => (current.id === id ? item : current))
        : visibleItems.filter((current) => current.id !== id);
      publishItems(nextItems);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Помилка");
    } finally {
      setPendingKey("");
    }
  }

  async function deleteItem(id: string) {
    const previousItems = visibleItems;
    const nextItems = previousItems.filter((item) => item.id !== id);
    setPendingKey(`delete:${id}`);
    publishItems(nextItems);
    try {
      await request("DELETE", { kind, id });
    } catch (error) {
      publishItems(previousItems);
      setMessage(error instanceof Error ? error.message : "Помилка");
    } finally {
      setPendingKey("");
    }
  }

  return (
    <Card>
      <div className="mb-3 font-semibold">{title}</div>
      <div className="grid gap-2">
        {visibleItems.map((item) => (
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
            <Button className="min-h-10" name="intent" value="save" disabled={pendingKey === `save:${item.id}`}>
              {pendingKey === `save:${item.id}` ? "Зберігаю..." : "Зберегти"}
            </Button>
            <Button className="min-h-10" variant="danger" type="button" disabled={pendingKey === `delete:${item.id}`} onClick={() => deleteItem(item.id)}>
              {pendingKey === `delete:${item.id}` ? "Видаляю..." : "Видалити"}
            </Button>
          </form>
        ))}
      </div>
      <form action={addItem} className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
        <label>
          {addLabel}
          <input name="name" value={newName} onChange={(event) => setNewName(event.target.value)} required />
        </label>
        <Button className="min-h-10" disabled={pendingKey === "add"}>{pendingKey === "add" ? "Додаю..." : "Додати"}</Button>
      </form>
      {message && <div className="mt-3 rounded-lg bg-muted p-3 text-sm">{message}</div>}
    </Card>
  );
}
