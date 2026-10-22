"use client";

import { Plus } from "lucide-react";
import { MobileNav } from "@/components/layout/app-nav";

const mobileTabs = [
  { href: "/overview", label: "Головна", icon: "overview" },
  { href: "/fx", label: "Форекс", icon: "fx" },
  { href: "/poly", label: "Poly", icon: "poly" },
  { href: "/steam", label: "Steam", icon: "steam" },
  { href: "/settings", label: "Меню", icon: "settings" }
] as const;

function openQuickAdd() {
  window.dispatchEvent(new Event("feelky:open-quick-add"));
}

export function MobileNavBar() {
  return <MobileNav items={mobileTabs} />;
}

export function MobileQuickAddButton() {
  return (
    <button
      type="button"
      onClick={openQuickAdd}
      aria-label="Додати операцію"
      className="grid h-9 w-9 place-items-center rounded-xl border border-border/70 bg-card text-primary shadow-sm transition-colors active:bg-muted md:hidden"
    >
      <Plus className="h-5 w-5" />
    </button>
  );
}
