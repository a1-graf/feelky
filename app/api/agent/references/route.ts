import { NextResponse } from "next/server";
import { authorizeAgent } from "@/lib/agent";
import { prisma } from "@/lib/db";
import { ACTIVE_EXPECTED_STATUSES } from "@/lib/ledger";
import { loadFlipSetups, loadFrozenFromAccounts } from "@/lib/telegram/operations";
import { listSteamAccounts } from "@/lib/steam-wallets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** The names the agent can use in operations: accounts, categories, sources, setups, frozen entries, Steam. */
export async function GET(request: Request) {
  const auth = await authorizeAgent(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const userId = auth.userId;
    const [accounts, categories, incomeSources, setups, frozen, steam, expected] = await Promise.all([
      prisma.account.findMany({ where: { userId }, orderBy: [{ type: "asc" }, { createdAt: "asc" }] }),
      prisma.category.findMany({ where: { userId }, orderBy: { sortOrder: "asc" } }),
      prisma.incomeSource.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
      loadFlipSetups(userId),
      loadFrozenFromAccounts(userId),
      listSteamAccounts(userId),
      prisma.expectedMoney.findMany({ where: { userId, status: { in: ACTIVE_EXPECTED_STATUSES } }, orderBy: { createdAt: "asc" } })
    ]);
    return NextResponse.json(
      {
        accounts: accounts.map((item) => ({
          name: item.name,
          type: item.type,
          currency: item.currency,
          balance: item.currentBalance.toString(),
          isReserved: item.isReserved,
          isActive: item.isActive
        })),
        categories: categories.map((item) => ({ name: item.name, isActive: item.isActive })),
        incomeSources: incomeSources.map((item) => ({ name: item.name, isActive: item.isActive })),
        flipSetups: setups,
        frozenFromAccounts: frozen.map((item) => ({
          id: item.id,
          title: item.title,
          amount: item.amount.toString(),
          currency: item.currency,
          fromAccount: item.sourceAccount?.name ?? null
        })),
        // Every active entry of "Заморожені бабки", own or expected from outside.
        expectedMoney: expected.map((item) => ({
          id: item.id,
          title: item.title,
          amount: item.amount.toString(),
          currency: item.currency,
          status: item.status,
          fromOwnAccount: Boolean(item.sourceAccountId)
        })),
        steamAccounts: steam.map((item) => ({ name: item.name, balance: item.currentSoftwareBalance.toString() }))
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[agent] references failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "References failed" }, { status: 500 });
  }
}
