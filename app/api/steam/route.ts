import { NextResponse } from "next/server";
import { SteamArbitrageResidualStatus } from "@prisma/client";
import { requireApiUserId } from "@/lib/session";
import { steamAnalytics, steamArbitrage, steamExpense, steamResale } from "@/lib/steam";

function asDate(value: unknown) {
  return value ? new Date(String(value)) : new Date();
}

export async function GET() {
  try {
    const userId = await requireApiUserId();
    await steamArbitrage.ensureDefaultSchemes(userId);
    return NextResponse.json(await steamAnalytics.dashboard(userId));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Steam error" }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireApiUserId();
    const body = await request.json();
    const action = body.action as string;

    if (action === "resaleAccount") {
      return NextResponse.json(await steamResale.createAccount(userId, body), { status: 201 });
    }
    if (action === "resaleInvestment") {
      return NextResponse.json(await steamResale.createInvestment(userId, {
        ...body,
        startedAt: asDate(body.startedAt),
        completedAt: body.completedAt ? asDate(body.completedAt) : null
      }), { status: 201 });
    }
    if (action === "resaleSnapshot") {
      return NextResponse.json(await steamResale.createSnapshot(userId, {
        ...body,
        snapshotDate: asDate(body.snapshotDate)
      }), { status: 201 });
    }
    if (action === "resaleWithdrawal") {
      return NextResponse.json(await steamResale.createWithdrawal(userId, {
        ...body,
        withdrawalDate: asDate(body.withdrawalDate)
      }), { status: 201 });
    }
    if (action === "scheme") {
      return NextResponse.json(await steamArbitrage.createScheme(userId, body), { status: 201 });
    }
    if (action === "round") {
      return NextResponse.json(await steamArbitrage.createRound(userId, {
        ...body,
        startedAt: asDate(body.startedAt)
      }), { status: 201 });
    }
    if (action === "completeRound") {
      return NextResponse.json(await steamArbitrage.completeRound(userId, {
        ...body,
        completedAt: asDate(body.completedAt)
      }));
    }
    if (action === "resolveResidual") {
      return NextResponse.json(await steamArbitrage.resolveResidual(userId, {
        ...body,
        status: body.status as SteamArbitrageResidualStatus
      }));
    }
    if (action === "expense") {
      return NextResponse.json(await steamExpense.createExpense(userId, {
        ...body,
        transactionDate: asDate(body.transactionDate)
      }), { status: 201 });
    }
    if (action === "expenseWithAllocation") {
      const expense = await steamExpense.createExpense(userId, {
        ...body,
        transactionDate: asDate(body.transactionDate)
      });
      await steamExpense.allocateExpense(userId, {
        expenseTransactionId: expense.id,
        resalePercent: body.resalePercent,
        arbitragePercent: body.arbitragePercent,
        arbitrageRoundId: body.arbitrageRoundId || null
      });
      return NextResponse.json(expense, { status: 201 });
    }
    if (action === "allocateExpense") {
      return NextResponse.json(await steamExpense.allocateExpense(userId, body));
    }
    return NextResponse.json({ error: "Unknown Steam action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Steam error" }, { status: 400 });
  }
}
