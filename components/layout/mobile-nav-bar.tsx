"use client";

import { MobileNav } from "@/components/layout/app-nav";

const mobileTabs = [
  { href: "/overview", label: "Огляд", icon: "overview" },
  { href: "/expenses", label: "Витрати", icon: "expenses" },
  { href: "/income", label: "Доходи", icon: "income" },
  { href: "/settings", label: "Меню", icon: "settings" }
] as const;

function openQuickAdd() {
  window.dispatchEvent(new Event("feelky:open-quick-add"));
}

export function MobileNavBar() {
  return <MobileNav items={mobileTabs} onAdd={openQuickAdd} />;
}