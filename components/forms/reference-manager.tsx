"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type RefKind = "category" | "incomeSource";

type RefItem = {
  id: string;
  name: string;
  isActive: boolean;
};

type SettingsResponse = {
  categories?: RefItem[];
  incomeSources?: RefItem[];
};

type DeleteResponse = {
  activeAfterDelete?: boolean;
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
  const deletingIds = useRef(new Set<string>());

  function publishItems(nextItems: RefItem[]) {
    setVisibleItems(nextItems);
    window.dispatchEvent(new CustomEvent("feelky:references-changed", { detail: { kind, items: nextItems } }));
  }

  async function request<T>(method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>) {
    setMessage("");
    const response = await fetch("/api/references", {
      method,
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Не вдалося зберегти");
    setMessage("Збережено");
    return data as T;
  }

  async function refreshFromServer() {
    const response = await fetch("/api/settings", { cache: "no-store" });
    const data = (await response.json().catch(() => ({}))) as SettingsResponse;
    if (!response.ok) throw new Error("Не вдалося оновити список після видалення");
    const nextItems = kind === "category" ? data.categories : data.incomeSources;
    if (!Array.isArray(nextItems)) throw new Error("Сервер повернув некоректний список");
    publishItems(nextItems.map((item) => ({ id: item.id, name: item.name, isActive: item.isActive })));
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
    if (!id) return;
    await saveItem(id);
  }

  function editItem(id: string, patch: Partial<RefItem>) {
    setVisibleItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  async function saveItem(id: string, patch: Partial<RefItem> = {}) {
    if (deletingIds.current.has(id)) return;
    const previousItems = visibleItems;
    const currentItem = visibleItems.find((item) => item.id === id);
    if (!currentItem || pendingKey === `save:${id}`) return;
    const name = String(patch.name ?? currentItem.name).trim();
    const isActive = patch.isActive ?? currentItem.isActive;
    if (!name) {
      setMessage("Назва не може бути пустою");
      return;
    }
    setPendingKey(`save:${id}`);
    try {
      const item = await request<RefItem>("PATCH", { kind, id, name, isActive });
      const nextItems = isActive
        ? visibleItems.map((current) => (current.id === id ? item : current))
        : visibleItems.filter((current) => current.id !== id);
      publishItems(nextItems);
    } catch (error) {
      if (deletingIds.current.has(id)) return;
      setVisibleItems(previousItems);
      setMessage(error instanceof Error ? error.message : "Помилка");
    } finally {
      setPendingKey("");
    }
  }

  async function deleteItem(id: string) {
    deletingIds.current.add(id);
    const previousItems = visibleItems;
    const nextItems = previousItems.filter((item) => item.id !== id);
    setPendingKey(`delete:${id}`);
    publishItems(nextItems);
    try {
      const result = await request<DeleteResponse>("DELETE", { kind, id });
      if (result.activeAfterDelete) throw new Error("Запис лишився активним після видалення");
      await refreshFromServer();
    } catch (error) {
      deletingIds.current.delete(id);
      publishItems(previousItems);
      setMessage(error instanceof Error ? error.message : "Помилка");
    } finally {
      deletingIds.current.delete(id);
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
              <input
                name="name"
                value={item.name}
                onBlur={(event) => {
                  if (!deletingIds.current.has(item.id)) void saveItem(item.id, { name: event.currentTarget.value });
                }}
                onChange={(event) => editItem(item.id, { name: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    event.currentTarget.blur();
                  }
                }}
                required
              />
            </label>
            <label className="flex min-h-10 flex-row items-center gap-2 text-[hsl(var(--card-foreground))]">
              <input
                className="h-5 w-5"
                type="checkbox"
                name="isActive"
                checked={item.isActive}
                onChange={(event) => {
                  const isActive = event.target.checked;
                  editItem(item.id, { isActive });
                  void saveItem(item.id, { isActive });
                }}
              />
              Активне
            </label>
            <Button className="min-h-10" name="intent" value="save" disabled={pendingKey === `save:${item.id}`}>
              {pendingKey === `save:${item.id}` ? "Зберігаю..." : "Зберегти"}
            </Button>
            <Button
              className="min-h-10"
              variant="danger"
              type="button"
              disabled={pendingKey === `delete:${item.id}`}
              onPointerDown={() => deletingIds.current.add(item.id)}
              onPointerCancel={() => {
                if (pendingKey !== `delete:${item.id}`) deletingIds.current.delete(item.id);
              }}
              onPointerLeave={() => {
                if (pendingKey !== `delete:${item.id}`) deletingIds.current.delete(item.id);
              }}
              onPointerUp={() => {
                if (pendingKey !== `delete:${item.id}`) deletingIds.current.delete(item.id);
              }}
              onClick={() => deleteItem(item.id)}
            >
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
