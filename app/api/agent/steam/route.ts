import { NextResponse } from "next/server";
import { authorizeAgent } from "@/lib/agent";
import { kyivStamp } from "@/lib/agent-query";
import { steamRecords, steamWallets } from "@/lib/steam-wallets";
import type { SteamWallet } from "@/lib/steam-wallets";
import type { WalletSummary } from "@/lib/steam-wallet-math";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function summary(item: WalletSummary) {
  return {
    balance: item.balance,
    investedReal: item.investedReal,
    receivedSteam: item.receivedSteam,
    bonus: item.bonus,
    bonusPercent: item.bonusPercent,
    withdrawnSteam: item.withdrawnSteam,
    withdrawnReal: item.withdrawnReal,
    difference: item.difference,
    differencePercent: item.differencePercent
  };
}

function serialize(wallet: SteamWallet) {
  return {
    name: wallet.name,
    currency: "USD",
    ...summary(wallet),
    updatedAt: wallet.updatedAt ? kyivStamp(wallet.updatedAt) : null,
    updatedBy: wallet.updatedBy,
    history: wallet.history.map((point) => ({ at: kyivStamp(point.at), balance: point.balance }))
  };
}

export async function GET(request: Request) {
  const auth = await authorizeAgent(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const [{ wallets, totals }, records] = await Promise.all([steamWallets(auth.userId, { historyDays: 7 }), steamRecords(auth.userId)]);
    return NextResponse.json(
      {
        accounts: wallets.map(serialize),
        totals: summary(totals),
        // Every record with its id, so it can be pointed at in an operation.
        investments: records.investments.map((item) => ({
          id: item.id,
          steamAccount: item.resaleAccount.name,
          investedReal: item.externalAmount.toString(),
          receivedSteam: item.receivedSteamAmount.toString(),
          from: item.sourceAccount.name,
          status: item.status,
          startedAt: kyivStamp(item.startedAt)
        })),
        withdrawals: records.withdrawals.map((item) => ({
          id: item.id,
          steamAccount: item.resaleAccount.name,
          spentSteam: item.softwareAmountSpent.toString(),
          receivedReal: item.amountReceived.toString(),
          to: item.destinationAccount.name,
          date: kyivStamp(item.withdrawalDate)
        })),
        rounds: records.rounds.map((item) => ({
          id: item.id,
          scheme: item.scheme.name,
          site: item.siteName,
          invested: item.investedAmount.toString(),
          received: item.finalAmountReceived?.toString() ?? null,
          status: item.status,
          from: item.sourceAccount.name,
          to: item.destinationAccount?.name ?? null,
          startedAt: kyivStamp(item.startedAt),
          completedAt: item.completedAt ? kyivStamp(item.completedAt) : null
        })),
        schemes: records.schemes.map((item) => item.name)
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[agent] steam list failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Steam list failed" }, { status: 500 });
  }
}
