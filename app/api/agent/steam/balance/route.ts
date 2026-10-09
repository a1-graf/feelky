import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { authorizeAgent } from "@/lib/agent";
import { kyivStamp } from "@/lib/agent-query";
import { steamBalanceInputSchema } from "@/lib/steam-input";
import { AGENT_SNAPSHOT_NOTE, findSteamAccount, listSteamAccounts, recordSteamBalance } from "@/lib/steam-wallets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * The agent's second write: the balance it read off a Steam wallet. It only records a
 * snapshot - it can not move money, create a завоз or touch any other account.
 */
export async function POST(request: Request) {
  const auth = await authorizeAgent(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }
  try {
    const input = steamBalanceInputSchema.parse(body);
    const account = await findSteamAccount(auth.userId, input.account);
    if (!account) {
      const known = (await listSteamAccounts(auth.userId)).map((item) => item.name);
      return NextResponse.json({ error: `Steam-акаунт «${input.account}» не знайдено`, accounts: known }, { status: 404 });
    }
    const result = await recordSteamBalance(auth.userId, {
      resaleAccountId: account.id,
      balance: input.balance,
      observedAt: input.observedAt ?? new Date(),
      note: AGENT_SNAPSHOT_NOTE
    });
    return NextResponse.json(
      {
        duplicate: result.duplicate,
        account: result.accountName,
        previousBalance: result.previousBalance,
        balance: result.currentBalance,
        observedAt: kyivStamp(result.observedAt),
        isLatest: result.isLatest
      },
      { status: result.duplicate ? 200 : 201 }
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid balance", issues: error.flatten().fieldErrors }, { status: 422 });
    }
    console.error("[agent] steam balance failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Steam balance failed" }, { status: 500 });
  }
}
