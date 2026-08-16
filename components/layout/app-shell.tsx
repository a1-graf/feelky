import { prisma } from "@/lib/db";
import { QuickAdd } from "@/components/forms/quick-add";
import { DesktopNav, MobileNav } from "@/components/layout/app-nav";
import { MobileLogout } from "@/components/layout/mobile-logout";
import { getCurrentSession } from "@/lib/session";

const nav = [
  { href: "/statistics", label: "Статистика", icon: "stats" },
  { href: "/flips", label: "Фліпи", icon: "flips" },
  { href: "/steam", label: "Steam", icon: "steam" }
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
    <div className={`${themeClass} min-h-screen bg-background text-foreground md:grid md:grid-cols-[248px_1fr]`}>
      <aside className="hidden border-r border-border/70 bg-card/60 backdrop-blur md:block">
        <div className="sticky top-0 flex h-screen flex-col p-4">
          <div className="mb-7 px-1">
            <div className="flex items-center gap-2.5">
              <img src="/icons/icon.svg" alt="" className="h-9 w-9 rounded-xl shadow-sm ring-1 ring-black/5" />
              <div className="text-xl font-semibold tracking-tight">Feelky</div>
            </div>
            <div className="mt-1 truncate text-xs text-muted-foreground">{session?.user?.email}</div>
          </div>
          <DesktopNav items={nav} />
          <div className="mt-auto">
            <MobileLogout />
          </div>
        </div>
      </aside>
      <main className="pb-28 md:pb-0">
        <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">{children}</div>
      </main>
      <MobileNav items={nav} />
      <QuickAdd />
    </div>
  );
}
