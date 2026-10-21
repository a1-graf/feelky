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
    const [accounts, categories, incomeSources, setups, frozen, steam, expected, polyLocks, polyAgents] = await Promise.all([
      prisma.account.findMany({ where: { userId }, orderBy: [{ type: "asc" }, { createdAt: "asc" }] }),
      prisma.category.findMany({ where: { userId }, orderBy: { sortOrder: "asc" } }),
      prisma.incomeSource.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
      loadFlipSetups(userId),
      loadFrozenFromAccounts(userId),
      listSteamAccounts(userId),
      prisma.expectedMoney.findMany({ where: { userId, status: { in: ACTIVE_EXPECTED_STATUSES } }, orderBy: { createdAt: "asc" } }),
      prisma.polyLock.findMany({ where: { userId, status: "LOCKED" }, orderBy: { unlockAt: "asc" } }),
      prisma.polyTrade.findMany({ where: { userId, agentName: { not: null } }, distinct: ["agentName"], select: { agentName: true } })
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
        steamAccounts: steam.map((item) => ({ name: item.name, balance: item.currentSoftwareBalance.toString() })),
        // Polymarket: sections and market kinds for trades, active AI-agent locks for poly_release.
        polymarket: {
          sections: ["MANUAL", "COPYTRADE", "AI_AGENT"],
          marketKinds: ["BTC_5M", "BTC_15M", "ETH_5M", "ETH_15M", "OTHER"],
          agents: polyAgents.map((item) => item.agentName),
          activeLocks: polyLocks.map((item) => ({ id: item.id, agentName: item.agentName, amountUsd: item.amountUsd.toString(), unlockAt: item.unlockAt.toISOString() }))
        }
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[agent] references failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "References failed" }, { status: 500 });
  }
}
