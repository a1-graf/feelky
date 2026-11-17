import { NextResponse } from "next/server";
import { authorizeAgent } from "@/lib/agent";
import { prisma } from "@/lib/db";
import { ACTIVE_EXPECTED_STATUSES } from "@/lib/ledger";
import { loadFlipSetups, loadFrozenFromAccounts } from "@/lib/telegram/operations";
import { listSteamAccounts } from "@/lib/steam-wallets";
import { ASSET_CATEGORIES } from "@/lib/assets";
import { listDebts } from "@/lib/debts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** The names the agent can use in operations: accounts, categories, sources, setups, frozen entries, Steam. */
export async function GET(request: Request) {
  const auth = await authorizeAgent(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const userId = auth.userId;
    const [accounts, categories, incomeSources, setups, frozen, steam, expected, polyLocks, polyAgents, debts, assets] = await Promise.all([
      prisma.account.findMany({ where: { userId }, orderBy: [{ type: "asc" }, { createdAt: "asc" }] }),
      prisma.category.findMany({ where: { userId }, orderBy: { sortOrder: "asc" } }),
      prisma.incomeSource.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
      loadFlipSetups(userId),
      loadFrozenFromAccounts(userId),
      listSteamAccounts(userId),
      prisma.expectedMoney.findMany({ where: { userId, status: { in: ACTIVE_EXPECTED_STATUSES } }, orderBy: { createdAt: "asc" } }),
      prisma.polyLock.findMany({ where: { userId, status: "LOCKED" }, orderBy: { unlockAt: "asc" } }),
      prisma.polyTrade.findMany({ where: { userId, agentName: { not: null } }, distinct: ["agentName"], select: { agentName: true } }),
      listDebts(userId),
      prisma.asset.findMany({ where: { userId, archivedAt: null }, orderBy: { createdAt: "asc" } })
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
        // Debts for debt_repay / debt_update / debt_delete: open first. BORROWED = the user owes, LENT = owed to the user.
        debts: {
          owedUsdt: debts.totals.owedUsdt,
          owedToMeUsdt: debts.totals.owedToMeUsdt,
          items: debts.debts.map((item) => ({ id: item.id, direction: item.direction, counterparty: item.counterparty, amount: item.amount, left: item.left, currency: item.currency, status: item.status }))
        },
        // Property for asset_update_value / asset_update / asset_delete.
        assets: assets.map((item) => ({ id: item.id, name: item.name, category: item.category, value: item.value.toString(), currency: item.currency })),
        assetCategories: ASSET_CATEGORIES,
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
