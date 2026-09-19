import { prisma } from "@/lib/db";
import { QuickAdd } from "@/components/forms/quick-add";
import { DesktopNav, type NavSection } from "@/components/layout/app-nav";
import { MobileLogout } from "@/components/layout/mobile-logout";
import { MobileNavBar } from "@/components/layout/mobile-nav-bar";
import { getCurrentSession } from "@/lib/session";

const navSections: readonly NavSection[] = [
  {
    label: "Головне",
    items: [
      { href: "/overview", label: "Огляд", icon: "overview" },
      { href: "/statistics", label: "Статистика", icon: "stats" }
    ]
  },
  {
    label: "Фінанси",
    items: [
      { href: "/income", label: "Доходи", icon: "income" },
      { href: "/expenses", label: "Витрати", icon: "expenses" },
      { href: "/withdrawals", label: "Виводи", icon: "withdrawals" },
      { href: "/crypto", label: "Гаманець", icon: "wallet" },
      { href: "/expected", label: "Заморожені", icon: "frozen" },
      { href: "/savings", label: "Відкладення", icon: "savings" }
    ]
  },
  {
    label: "Модулі",
    items: [
      { href: "/flips", label: "Фліпи", icon: "flips" },
      { href: "/steam", label: "Steam", icon: "steam" }
    ]
  },
  {
    label: "Система",
    items: [
      { href: "/archive", label: "Архів", icon: "archive" },
      { href: "/settings", label: "Налаштування", icon: "settings" }
    ]
  }
] as const;

export async function AppShell({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession();
  const userId = session?.user?.id;

  // Unauthenticated routes (sign in) render without app chrome.
  if (!userId) {
    return <>{children}</>;
  }

  const rawSettings = await prisma.settings.findUnique({ where: { userId }, select: { theme: true } });
  const themeClass = rawSettings?.theme === "dark" ? "dark" : "";

  return (
    <div className={`${themeClass} min-h-screen bg-background text-foreground md:grid md:grid-cols-[260px_1fr]`}>
      <aside className="hidden border-r border-border/60 bg-card/50 backdrop-blur md:block">
        <div className="sticky top-0 flex h-screen flex-col p-4">
          <div className="mb-6 px-1">
            <div className="flex items-center gap-2.5">
              <img src="/icons/icon.svg" alt="" className="h-9 w-9 rounded-xl shadow-sm ring-1 ring-black/5" />
              <div className="text-xl font-bold tracking-tight">Feelky</div>
            </div>
            <div className="mt-1 truncate text-xs text-muted-foreground">{session?.user?.email}</div>
          </div>
          <DesktopNav sections={navSections} />
          <div className="mt-auto pt-4">
            <MobileLogout />
          </div>
        </div>
      </aside>
      <main className="pb-32 md:pb-0">
        <header className="sticky top-0 z-30 -mx-4 mb-2 flex items-center justify-between border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur-xl md:hidden">
          <div className="flex items-center gap-2">
            <img src="/icons/icon.svg" alt="" className="h-7 w-7 rounded-lg shadow-sm" />
            <span className="text-base font-bold tracking-tight">Feelky</span>
          </div>
          <MobileLogout />
        </header>
        <div className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-6 lg:px-8">{children}</div>
      </main>
      <MobileNavBar />
      <QuickAdd />
    </div>
  );
}
