import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Needs a migrated Postgres in DATABASE_URL (never production). Skipped unless DEBTS_DB_TEST=1.
const enabled = process.env.DEBTS_DB_TEST === "1";

describe.skipIf(!enabled)("Debts and property on a real database", () => {
  const email = `debts-test-${Date.now()}@example.com`;
  let userId = "";
  const card = () => `${userId}-card`;
  const wallet = () => `${userId}-wallet`;

  beforeAll(async () => {
    const { prisma } = await import("@/lib/db");
    const user = await prisma.user.create({ data: { email } });
    userId = user.id;
    await prisma.settings.create({ data: { userId, rateMode: "MANUAL", manualUahUsdtRate: "40" } });
    await prisma.account.create({ data: { id: card(), userId, name: "Картка", type: "BANK_CARD", currency: "UAH", currentBalance: "1000" } });
    await prisma.account.create({ data: { id: wallet(), userId, name: "Гаманець", type: "EXCHANGE", currency: "USDT", currentBalance: "100" } });
  });

  afterAll(async () => {
    const { prisma } = await import("@/lib/db");
    await prisma.transaction.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  const balance = async (id: string) => {
    const { prisma } = await import("@/lib/db");
    return (await prisma.account.findUniqueOrThrow({ where: { id } })).currentBalance.toString();
  };

  it("borrows, repays in parts, closes, and never touches income or expenses", async () => {
    const { createDebt, repayDebt, listDebts } = await import("@/lib/debts");
    const { getDashboard } = await import("@/lib/dashboard");
    const before = await getDashboard(userId, { period: "month" });

    const debt = await createDebt(userId, { direction: "BORROWED", counterparty: "Андрій", amount: "4000", currency: "UAH", accountId: card(), startedAt: new Date() });
    expect(await balance(card())).toBe("5000");

    const after = await getDashboard(userId, { period: "month" });
    expect(after.totals.monthIncomeUsdt).toBe(before.totals.monthIncomeUsdt);
    expect(after.totals.monthExpenseUah).toBe(before.totals.monthExpenseUah);
    // The cash is in the bank; the debt takes it back out of net capital.
    expect(Number(after.totals.potentialBankUsdt) - Number(before.totals.potentialBankUsdt)).toBeCloseTo(100, 6);
    expect(after.totals.debtsOwedUsdt).toBe("100");
    expect(Number(after.totals.netCapitalUsdt)).toBeCloseTo(Number(before.totals.netCapitalUsdt), 6);

    await expect(repayDebt(userId, { debtId: debt.id, amount: "5000", accountId: card(), date: new Date() })).rejects.toThrow(/Залишок/);
    await expect(repayDebt(userId, { debtId: debt.id, amount: "10", accountId: wallet(), date: new Date() })).rejects.toThrow(/валюті/);
    const part = await repayDebt(userId, { debtId: debt.id, amount: "1500", accountId: card(), date: new Date() });
    expect(part.left.toString()).toBe("2500");
    expect(await balance(card())).toBe("3500");
    const rest = await repayDebt(userId, { debtId: debt.id, accountId: card(), date: new Date() });
    expect(rest.debt.status).toBe("CLOSED");
    expect(await balance(card())).toBe("1000");

    const listed = await listDebts(userId);
    expect(listed.debts[0]).toMatchObject({ status: "CLOSED", left: "0", repaid: "4000" });
    expect(listed.totals.owedUsdt).toBe("0");
    const end = await getDashboard(userId, { period: "month" });
    expect(end.totals.monthIncomeUsdt).toBe(before.totals.monthIncomeUsdt);
    expect(end.totals.monthExpenseUah).toBe(before.totals.monthExpenseUah);
  });

  it("archiving a repayment reopens the debt; the principal goes only with the debt", async () => {
    const { prisma } = await import("@/lib/db");
    const { createDebt, repayDebt, deleteDebt } = await import("@/lib/debts");
    const { ledger } = await import("@/lib/ledger");
    const debt = await createDebt(userId, { direction: "LENT", counterparty: "Олег", amount: "30", currency: "USDT", accountId: wallet(), startedAt: new Date() });
    expect(await balance(wallet())).toBe("70");
    const paid = await repayDebt(userId, { debtId: debt.id, accountId: wallet(), date: new Date() });
    expect(await balance(wallet())).toBe("100");
    expect(paid.debt.status).toBe("CLOSED");

    await ledger.archiveTransaction(userId, paid.transaction.id);
    expect(await balance(wallet())).toBe("70");
    expect((await prisma.debt.findUniqueOrThrow({ where: { id: debt.id } })).status).toBe("OPEN");
    await ledger.restoreTransaction(userId, paid.transaction.id);
    expect((await prisma.debt.findUniqueOrThrow({ where: { id: debt.id } })).status).toBe("CLOSED");
    await ledger.archiveTransaction(userId, paid.transaction.id);

    const principal = await prisma.transaction.findFirstOrThrow({ where: { debtId: debt.id, archivedAt: null } });
    await expect(ledger.archiveTransaction(userId, principal.id)).rejects.toThrow(/Борги/);

    const removed = await deleteDebt(userId, debt.id);
    expect(removed.reversed).toBe(1);
    expect(await balance(wallet())).toBe("100");
    await expect(ledger.restoreTransaction(userId, principal.id)).rejects.toThrow(/боргу/);
  });

  it("records a debt without moving money", async () => {
    const { createDebt, listDebts } = await import("@/lib/debts");
    await createDebt(userId, { direction: "BORROWED", counterparty: "Старий борг", amount: "800", currency: "UAH", startedAt: new Date() });
    expect(await balance(card())).toBe("1000");
    expect((await listDebts(userId)).totals.owedUsdt).toBe("20");
  });

  it("keeps property beside the bank and remembers every estimate", async () => {
    const { createAsset, revalueAsset, deleteAsset, listAssets } = await import("@/lib/assets");
    const { getDashboard } = await import("@/lib/dashboard");
    const before = await getDashboard(userId, { period: "month" });
    const car = await createAsset(userId, { name: "Машина", category: "Транспорт", value: "5000", currency: "USD", valuedAt: new Date(Date.now() - 86_400_000) });
    await revalueAsset(userId, { assetId: car.id, value: "4800", valuedAt: new Date() });
    await revalueAsset(userId, { assetId: car.id, value: "9999", valuedAt: new Date(Date.now() - 10 * 86_400_000), note: "давня оцінка" });
    await createAsset(userId, { name: "Ноутбук", category: "Техніка", value: "40000", currency: "UAH", valuedAt: new Date() });

    const list = await listAssets(userId);
    expect(list.assets.find((asset) => asset.name === "Машина")).toMatchObject({ value: "4800", currency: "USD" });
    expect(list.assets.find((asset) => asset.name === "Машина")?.history).toHaveLength(3);
    expect(list.totals.totalUsdt).toBe("5800");

    const after = await getDashboard(userId, { period: "month" });
    expect(after.totals.potentialBankUsdt).toBe(before.totals.potentialBankUsdt);
    expect(after.totals.availableBankUsdt).toBe(before.totals.availableBankUsdt);
    expect(after.totals.assetsUsdt).toBe("5800");
    expect(Number(after.totals.netCapitalUsdt) - Number(before.totals.netCapitalUsdt)).toBeCloseTo(5800, 6);

    await deleteAsset(userId, car.id);
    expect((await listAssets(userId)).totals.totalUsdt).toBe("1000");
  });
});
