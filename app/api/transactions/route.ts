import { NextResponse } from "next/server";
import type { Currency } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ledger } from "@/lib/ledger";
import {
  cashWithdrawalSchema,
  expenseSchema,
  incomeSchema,
  manualAdjustmentSchema,
  p2pWithdrawalSchema,
  savingsDepositSchema,
  transactionFiltersSchema
} from "@/lib/schemas";
import { requireApiUserId } from "@/lib/session";

export async function GET(request: Request) {
  try {
    const userId = await requireApiUserId();
    const url = new URL(request.url);
    const filters = transactionFiltersSchema.parse(Object.fromEntries(url.searchParams));
    const where = {
      userId,
      archivedAt: filters.archived ? { not: null } : null,
      ...(filters.type ? { type: filters.type as never } : {}),
      ...(filters.currency ? { currency: filters.currency as never } : {}),
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.incomeSourceId ? { incomeSourceId: filters.incomeSourceId } : {}),
      ...(filters.accountId ? { OR: [{ sourceAccountId: filters.accountId }, { destinationAccountId: filters.accountId }] } : {}),
      ...(filters.from || filters.to ? { transactionDate: { gte: filters.from, lte: filters.to } } : {}),
      ...(filters.q ? { note: { contains: filters.q, mode: "insensitive" as const } } : {})
    };
    const [items, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: { sourceAccount: true, destinationAccount: true, category: true, incomeSource: true },
        orderBy: { transactionDate: "desc" },
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize
      }),
      prisma.transaction.count({ where })
    ]);
    return NextResponse.json({ items, total, page: filters.page, pageSize: filters.pageSize });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Transactions error" }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireApiUserId();
    const body = await request.json();
    const action = body.action as string;
    if (action === "income") {
      const input = incomeSchema.parse(body);
      return NextResponse.json(await ledger.createIncome(userId, {
        ...input,
        currency: input.currency as Currency
      }), { status: 201 });
    }
    if (action === "expense") {
      const input = expenseSchema.parse(body);
      return NextResponse.json(await ledger.createExpense(userId, {
        ...input,
        currency: input.currency as Currency
      }), { status: 201 });
    }
    if (action === "savings") {
      const input = savingsDepositSchema.parse(body);
      return NextResponse.json(await ledger.createSavingsDeposit(userId, input), { status: 201 });
    }
    if (action === "p2p") {
      const input = p2pWithdrawalSchema.parse(body);
      return NextResponse.json(await ledger.createP2PWithdrawal(userId, input), { status: 201 });
    }
    if (action === "cash") {
      const input = cashWithdrawalSchema.parse(body);
      return NextResponse.json(await ledger.createCashWithdrawal(userId, {
        ...input,
        receivedCurrency: input.receivedCurrency as "UAH" | "USD"
      }), { status: 201 });
    }
    if (action === "manual") {
      const input = manualAdjustmentSchema.parse(body);
      return NextResponse.json(await ledger.createManualAdjustment(userId, input), { status: 201 });
    }
    if (action === "archive") {
      return NextResponse.json(await ledger.archiveTransaction(userId, body.transactionId));
    }
    if (action === "restore") {
      return NextResponse.json(await ledger.restoreTransaction(userId, body.transactionId));
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Transaction error" }, { status: 400 });
  }
}
