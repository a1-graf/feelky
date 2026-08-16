"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BarChart3, TrendingUp } from "lucide-react";
import { cn } from "@/lib/ui";

type NavItem = {
  href: string;
  label: string;
  icon: "stats" | "flips" | "steam";
};

function SteamIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M11.98 2C7.04 2 2.93 5.56 2.1 10.25l5.37 2.22a2.82 2.82 0 0 1 1.55-.46h.16l2.39-3.46v-.05a3.77 3.77 0 1 1 3.77 3.77h-.08l-3.4 2.43v.14a2.84 2.84 0 0 1-5.62.56l-3.84-1.59A10 10 0 1 0 11.98 2Zm-2.96 11.39a1.45 1.45 0 0 0-.72.19l1.64.68a1.05 1.05 0 0 1 .58.6 1.1 1.1 0 0 1-.01.84 1.08 1.08 0 0 1-1.42.58l-1.57-.65a1.46 1.46 0 1 0 1.5-2.24Zm6.22-6.87a1.97 1.97 0 1 0 0 3.94 1.97 1.97 0 0 0 0-3.94Zm0 .55a1.42 1.42 0 1 1 0 2.84 1.42 1.42 0 0 1 0-2.84Z" />
    </svg>
  );
}

const icons = {
  stats: BarChart3,
  flips: TrendingUp,
  steam: SteamIcon
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

export function DesktopNav({ items }: { items: readonly NavItem[] }) {
  const pathname = usePathname();
  const { isActive, onNavigate } = useOptimisticActive(pathname);
  return (
    <nav className="grid gap-1">
      {items.map((item) => {
        const active = isActive(item.href);
        const Icon = icons[item.icon];
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch
            onClick={() => onNavigate(item.href)}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm transition-colors duration-150",
              active
                ? "bg-primary/12 font-semibold text-primary ring-1 ring-inset ring-primary/20"
                : "text-[hsl(var(--card-muted-foreground))] hover:bg-muted/60 hover:text-foreground"
            )}
          >
            <Icon className="h-[18px] w-[18px]" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileNav({ items }: { items: readonly NavItem[] }) {
  const pathname = usePathname();
  const { isActive, onNavigate } = useOptimisticActive(pathname);
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 grid border-t border-border/70 bg-card/85 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-lg md:hidden"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((item) => {
        const active = isActive(item.href);
        const Icon = icons[item.icon];
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch
            onClick={() => onNavigate(item.href)}
            className={cn(
              "grid min-h-14 place-items-center gap-1 rounded-xl text-[10px] font-medium transition-colors duration-150",
              active ? "text-primary" : "text-muted-foreground"
            )}
          >
            <span className={cn("grid h-8 w-14 place-items-center rounded-full transition-colors duration-150", active && "bg-primary/12")}>
              <Icon className="h-5 w-5" />
            </span>
            <span className={cn(active && "font-semibold")}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
