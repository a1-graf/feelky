import { NextResponse } from "next/server";
import { SteamArbitrageResidualStatus } from "@prisma/client";
import { apiError } from "@/lib/api-error";
import { requireApiUserId } from "@/lib/session";
import {
  steamAllocateExpenseSchema,
  steamCompleteRoundSchema,
  steamExpenseSchema,
  steamExpenseWithAllocationSchema,
  steamResaleAccountSchema,
  steamResaleInvestmentReceivedSchema,
  steamResaleInvestmentSchema,
  steamResaleSnapshotSchema,
  steamResaleTopUpSchema,
  steamResaleWithdrawalSchema,
  steamResolveResidualSchema,
  steamRoundSchema,
  steamSchemeSchema
} from "@/lib/schemas";
import { steamAnalytics, steamArbitrage, steamExpense, steamResale } from "@/lib/steam";

function asDate(value: unknown) {
  return value ? new Date(String(value)) : new Date();
}

function optionalDate(value: unknown) {
  return value ? asDate(value) : null;
}

export async function GET() {
  try {
    const userId = await requireApiUserId();
    await steamArbitrage.ensureDefaultSchemes(userId);
    return NextResponse.json(await steamAnalytics.dashboard(userId));
  } catch (error) {
    return apiError(error, "Steam error");
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireApiUserId();
    const body = await request.json();
    const action = body.action as string;

    if (action === "resaleAccount") {
      const input = steamResaleAccountSchema.parse(body);
      return NextResponse.json(await steamResale.createAccount(userId, input), { status: 201 });
    }
    if (action === "resaleInvestment") {
      const input = steamResaleInvestmentSchema.parse(body);
      return NextResponse.json(await steamResale.createInvestment(userId, {
        ...input,
        startedAt: asDate(body.startedAt),
        completedAt: optionalDate(body.completedAt)
      }), { status: 201 });
    }
    if (action === "resaleInvestmentReceived") {
      const input = steamResaleInvestmentReceivedSchema.parse(body);
      return NextResponse.json(await steamResale.updateInvestmentReceived(userId, {
        ...input,
        completedAt: body.completedAt ? asDate(body.completedAt) : new Date()
      }));
    }
    if (action === "resaleInvestmentTopUp") {
      const input = steamResaleTopUpSchema.parse(body);
      return NextResponse.json(await steamResale.addInvestmentAmount(userId, input));
    }
    if (action === "resaleSnapshot") {
      const input = steamResaleSnapshotSchema.parse(body);
      return NextResponse.json(await steamResale.createSnapshot(userId, {
        ...input,
        snapshotDate: asDate(body.snapshotDate)
      }), { status: 201 });
    }
    if (action === "resaleWithdrawal") {
      const input = steamResaleWithdrawalSchema.parse(body);
      return NextResponse.json(await steamResale.createWithdrawal(userId, {
        ...input,
        withdrawalDate: asDate(body.withdrawalDate)
      }), { status: 201 });
    }
    if (action === "scheme") {
      const input = steamSchemeSchema.parse(body);
      return NextResponse.json(await steamArbitrage.createScheme(userId, input), { status: 201 });
    }
    if (action === "round") {
      const input = steamRoundSchema.parse(body);
      return NextResponse.json(await steamArbitrage.createRound(userId, {
        ...input,
        startedAt: asDate(body.startedAt)
      }), { status: 201 });
    }
    if (action === "completeRound") {
      const input = steamCompleteRoundSchema.parse(body);
      return NextResponse.json(await steamArbitrage.completeRound(userId, {
        ...input,
        completedAt: asDate(body.completedAt)
      }));
    }
    if (action === "resolveResidual") {
      const input = steamResolveResidualSchema.parse(body);
      return NextResponse.json(await steamArbitrage.resolveResidual(userId, {
        ...input,
        status: input.status as SteamArbitrageResidualStatus
      }));
    }
    if (action === "expense") {
      const input = steamExpenseSchema.parse(body);
      return NextResponse.json(await steamExpense.createExpense(userId, {
        ...input,
        transactionDate: asDate(body.transactionDate)
      }), { status: 201 });
    }
    if (action === "expenseWithAllocation") {
      const input = steamExpenseWithAllocationSchema.parse(body);
      const expense = await steamExpense.createExpense(userId, {
        sourceAccountId: input.sourceAccountId,
        amount: input.amount,
        note: input.note,
        transactionDate: asDate(body.transactionDate)
      });
      await steamExpense.allocateExpense(userId, {
        expenseTransactionId: expense.id,
        resalePercent: input.resalePercent,
        arbitragePercent: input.arbitragePercent,
        arbitrageRoundId: input.arbitrageRoundId || null
      });
      return NextResponse.json(expense, { status: 201 });
    }
    if (action === "allocateExpense") {
      const input = steamAllocateExpenseSchema.parse(body);
      return NextResponse.json(await steamExpense.allocateExpense(userId, input), { status: 200 });
    }
    return NextResponse.json({ error: "Unknown Steam action" }, { status: 400 });
  } catch (error) {
    return apiError(error, "Steam error");
  }
}
