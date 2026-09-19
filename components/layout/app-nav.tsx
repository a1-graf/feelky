"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Archive,
  ArrowDownToLine,
  ArrowUpFromLine,
  Banknote,
  BarChart3,
  LayoutDashboard,
  PiggyBank,
  Settings,
  Snowflake,
  TrendingUp,
  Wallet
} from "lucide-react";
import { cn } from "@/lib/ui";

export type NavIcon =
  | "overview"
  | "stats"
  | "income"
  | "expenses"
  | "withdrawals"
  | "wallet"
  | "frozen"
  | "savings"
  | "flips"
  | "steam"
  | "archive"
  | "settings";

export type NavItem = {
  href: string;
  label: string;
  icon: NavIcon;
};

export type NavSection = {
  label: string;
  items: readonly NavItem[];
};

function SteamIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M11.98 2C7.04 2 2.93 5.56 2.1 10.25l5.37 2.22a2.82 2.82 0 0 1 1.55-.46h.16l2.39-3.46v-.05a3.77 3.77 0 1 1 3.77 3.77h-.08l-3.4 2.43v.14a2.84 2.84 0 0 1-5.62.56l-3.84-1.59A10 10 0 1 0 11.98 2Zm-2.96 11.39a1.45 1.45 0 0 0-.72.19l1.64.68a1.05 1.05 0 0 1 .58.6 1.1 1.1 0 0 1-.01.84 1.08 1.08 0 0 1-1.42.58l-1.57-.65a1.46 1.46 0 1 0 1.5-2.24Zm6.22-6.87a1.97 1.97 0 1 0 0 3.94 1.97 1.97 0 0 0 0-3.94Zm0 .55a1.42 1.42 0 1 1 0 2.84 1.42 1.42 0 0 1 0-2.84Z" />
    </svg>
  );
}

const icons: Record<NavIcon, React.ComponentType<{ className?: string }>> = {
  overview: LayoutDashboard,
  stats: BarChart3,
  income: ArrowDownToLine,
  expenses: ArrowUpFromLine,
  withdrawals: Banknote,
  wallet: Wallet,
  frozen: Snowflake,
  savings: PiggyBank,
  flips: TrendingUp,
  steam: SteamIcon,
  archive: Archive,
  settings: Settings
};

function matchesPath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Highlights the tapped tab instantly, before the server view resolves. */
function useOptimisticActive(pathname: string) {
  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => setPending(null), [pathname]);
  const isActive = (href: string) => (pending ? pending === href : matchesPath(pathname, href));
  return { isActive, onNavigate: setPending };
}

export function DesktopNav({ sections }: { sections: readonly NavSection[] }) {
  const pathname = usePathname();
  const { isActive, onNavigate } = useOptimisticActive(pathname);
  return (
    <nav className="grid gap-5 overflow-y-auto">
      {sections.map((section) => (
        <div key={section.label} className="grid gap-0.5">
          <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60">
            {section.label}
          </div>
          {section.items.map((item) => {
            const active = isActive(item.href);
            const Icon = icons[item.icon];
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                onClick={() => onNavigate(item.href)}
                className={cn(
                  "relative flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm transition-all duration-150",
                  active
                    ? "bg-primary/10 font-semibold text-primary"
                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                )}
              >
                {active && <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-primary" />}
                <Icon className="h-[18px] w-[18px] shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function MobileNav({ items, onAdd }: { items: readonly NavItem[]; onAdd: () => void }) {
  const pathname = usePathname();
  const { isActive, onNavigate } = useOptimisticActive(pathname);
  const slots: (NavItem | "add")[] = [items[0], items[1], "add", items[2], items[3]];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-card/90 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-xl md:hidden">
      <div className="grid grid-cols-5">
        {slots.map((slot, index) => {
          if (slot === "add") {
            return (
              <div key="add" className="grid place-items-center">
                <button
                  type="button"
                  onClick={onAdd}
                  aria-label="Додати операцію"
                  className="-mt-6 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-glow ring-4 ring-background transition-transform duration-150 active:scale-95"
                >
                  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </button>
              </div>
            );
          }
          const active = isActive(slot.href);
          const Icon = icons[slot.icon];
          return (
            <Link
              key={slot.href}
              href={slot.href}
              prefetch
              onClick={() => onNavigate(slot.href)}
              className={cn(
                "grid min-h-14 place-items-center gap-0.5 rounded-xl text-[10px] font-medium transition-colors duration-150",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <span className={cn("grid h-7 w-12 place-items-center rounded-full transition-colors duration-150", active && "bg-primary/12")}>
                <Icon className="h-5 w-5" />
              </span>
              <span className={cn(active && "font-semibold")}>{slot.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
