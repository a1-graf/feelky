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
  const rawSettings = userId ? await prisma.settings.findUnique({ where: { userId }, select: { theme: true } }) : null;

  const themeClass = rawSettings?.theme === "dark" ? "dark" : "";

  return (
    <div className={`${themeClass} min-h-screen bg-background text-foreground md:grid md:grid-cols-[244px_1fr]`}>
      <aside className="hidden border-r border-border bg-card md:block">
        <div className="sticky top-0 flex h-screen flex-col p-4">
          <div className="mb-6">
            <div className="flex items-center gap-2">
              <img src="/icons/icon.svg" alt="" className="h-9 w-9 rounded-lg" />
              <div className="text-xl font-semibold">Feelky</div>
            </div>
            <div className="text-sm text-muted-foreground">{session?.user?.email}</div>
          </div>
          <DesktopNav items={nav} />
          <div className="mt-auto">
            <MobileLogout />
          </div>
        </div>
      </aside>
      <main className="pb-24 md:pb-0">
        <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">{children}</div>
      </main>
      <MobileNav items={nav} />
      <QuickAdd />
    </div>
  );
}
