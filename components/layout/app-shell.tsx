import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { QuickAdd } from "@/components/forms/quick-add";
import { DesktopNav, MobileNav } from "@/components/layout/app-nav";
import { MobileLogout } from "@/components/layout/mobile-logout";

const nav = [
  { href: "/statistics", label: "Статистика", icon: "stats" },
  { href: "/flips", label: "Фліпи", icon: "flips" },
  { href: "/steam", label: "Steam", icon: "steam" }
] as const;

export async function AppShell({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const [rawAccounts, rawCategories, rawIncomeSources, rawSettings] = userId
    ? await Promise.all([
        prisma.account.findMany({ where: { userId, isActive: true }, orderBy: { createdAt: "asc" } }),
        prisma.category.findMany({ where: { userId, isActive: true }, orderBy: { sortOrder: "asc" } }),
        prisma.incomeSource.findMany({ where: { userId, isActive: true }, orderBy: { createdAt: "asc" } }),
        prisma.settings.findUnique({ where: { userId } })
      ])
    : [[], [], [], null];
  const accounts = rawAccounts.map((account) => ({
    id: account.id,
    name: account.name,
    type: account.type,
    currency: account.currency,
    currentBalance: account.currentBalance.toString()
  }));
  const categories = rawCategories.map((category) => ({ id: category.id, name: category.name }));
  const incomeSources = rawIncomeSources.map((source) => ({ id: source.id, name: source.name }));
  const settings = rawSettings
    ? {
        p2pSourceAccountId: rawSettings.p2pSourceAccountId,
        p2pDestinationAccountId: rawSettings.p2pDestinationAccountId,
        expenseDefaultSourceId: rawSettings.expenseDefaultSourceId,
        cashExchangePlace: rawSettings.cashExchangePlace
      }
    : null;

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
      <QuickAdd accounts={accounts} categories={categories} incomeSources={incomeSources} settings={settings} />
    </div>
  );
}
