import { AccountType, ExpectedMoneyStatus, Prisma, RateMode } from "@prisma/client";
import type { Account, TelegramSession } from "@prisma/client";
import { z } from "zod";
import { RawAccessError, rawCreate, rawDelete, rawUpdate } from "@/lib/agent-raw";
import { prisma } from "@/lib/db";
import { undoFlipWithLedger } from "@/lib/flips";
import { decimalString } from "@/lib/fx-input";
import { deleteFxTradeWithLedger } from "@/lib/fx";
import { ACTIVE_EXPECTED_STATUSES, ledger } from "@/lib/ledger";
import { steamArbitrage, steamResale } from "@/lib/steam";
import { resolveReceivedAmount } from "@/lib/steam-wallet-math";
import { deleteSteamRound, deleteSteamWithdrawal, findSteamAccount, undoSteamInvestment } from "@/lib/steam-wallets";
import { isValidDateKey, kyivToday, resolveTransactionDate } from "@/lib/telegram/dates";
import {
  loadFrozenFromAccounts,
  loadReferenceData,
  pickExpenseAccount,
  pickIncomeAccount,
  prismaUndoGateway,
  submitCash,
  submitExpectedMoney,
  submitExpense,
  submitFlip,
  submitFreeze,
  submitIncome,
  submitManualAdjustment,
  submitP2P,
  submitP2PDeposit,
  submitSavings,
  submitSteamInvestment,
  submitTransfer,
  submitUnfreeze
} from "@/lib/telegram/operations";
import type { OperationResult, ReferenceData } from "@/lib/telegram/operations";
import type { TelegramCurrency } from "@/lib/telegram/parse";
import { decodeUndoRef, encodeUndoRef, performUndo, undoMessage } from "@/lib/telegram/undo";

/**
 * Full write access for the agent (OpenClaw): every change the bot and the site can make,
 * through the same functions they use, so balances and statistics stay consistent.
 */

const positive = decimalString.refine((value) => !value.startsWith("-") && Number(value) > 0, "Має бути більше за нуль");
const signed = decimalString;
const name = z.string().trim().min(1).max(80);
const recordId = z.string().trim().min(1).max(40);
const note = z.string().trim().max(200).optional().nullable();
const currency = z.string().transform((value) => value.trim().toUpperCase()).pipe(z.enum(["UAH", "USDT", "USD"]));
const date = z
  .string()
  .trim()
  .refine(isValidDateKey, "Дата у форматі YYYY-MM-DD")
  .refine((value) => value <= kyivToday(), "Дата не може бути в майбутньому")
  .optional();

export const agentOperationSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("expense"), amount: positive, currency: currency.optional(), account: name.optional(), category: name, note, date }),
  z.object({ type: z.literal("work_expense"), amount: positive, currency: currency.optional(), account: name.optional(), direction: name, note, date }),
  z.object({ type: z.literal("income"), amount: positive, currency: currency.optional(), account: name.optional(), source: name, note, date }),
  z.object({ type: z.literal("transfer"), amount: positive, from: name, to: name, note, date }),
  z.object({ type: z.literal("savings"), amount: positive, from: name.optional(), note, date }),
  z.object({ type: z.literal("p2p"), receivedUah: positive, rate: positive, note, date }),
  z.object({ type: z.literal("p2p_deposit"), spentUah: positive, rate: positive, note, date }),
  z.object({ type: z.literal("cash"), receivedAmount: positive, currency: z.enum(["UAH", "USD"]).optional(), rate: positive, place: note, date }),
  z.object({ type: z.literal("expected"), amount: positive, currency: currency.optional(), title: note }),
  z.object({ type: z.literal("freeze"), amount: positive, currency: currency.optional(), account: name.optional(), title: note, date }),
  z.object({ type: z.literal("unfreeze"), entry: name }),
  z.object({ type: z.literal("flip"), pnl: signed, setup: name, date }),
  z.object({ type: z.literal("set_balance"), account: name, balance: signed }),
  z.object({ type: z.literal("steam_investment"), steamAccount: name, amount: positive, received: z.string().trim().max(20).optional(), from: name.optional(), date }),
  z.object({ type: z.literal("create_steam_account"), name, balance: decimalString.optional() }),
  z.object({ type: z.literal("undo"), ref: z.string().trim().min(3).max(60) }),
  z.object({ type: z.literal("delete"), transactionId: z.string().trim().min(1).max(40), permanent: z.boolean().optional() }),
  z.object({ type: z.literal("restore"), transactionId: z.string().trim().min(1).max(40) }),
  z.object({
    type: z.literal("create_account"),
    name,
    accountType: z.nativeEnum(AccountType),
    currency,
    balance: decimalString.optional(),
    isReserved: z.boolean().optional()
  }),
  z.object({ type: z.literal("update_account"), account: name, name: name.optional(), isReserved: z.boolean().optional(), isActive: z.boolean().optional() }),
  z.object({ type: z.literal("create_category"), name }),
  z.object({ type: z.literal("update_category"), category: name, name: name.optional(), isActive: z.boolean().optional() }),
  z.object({ type: z.literal("create_source"), name }),
  z.object({ type: z.literal("update_source"), source: name, name: name.optional(), isActive: z.boolean().optional() }),
  z.object({
    type: z.literal("update_settings"),
    monthlyExpenseLimit: positive.optional(),
    rateMode: z.nativeEnum(RateMode).optional(),
    manualRate: positive.optional().nullable(),
    hideAmounts: z.boolean().optional()
  }),
  // Steam: arbitrage rounds, завози and withdrawals, by the ids from GET /api/agent/steam.
  z.object({ type: z.literal("steam_round_create"), scheme: name, site: note, amount: positive, from: name.optional(), date }),
  z.object({ type: z.literal("steam_round_complete"), roundId: recordId, received: positive, remaining: decimalString.optional(), to: name.optional(), note, date }),
  z.object({ type: z.literal("steam_round_delete"), roundId: recordId, refund: z.boolean().optional() }),
  z.object({ type: z.literal("steam_scheme_create"), name }),
  z.object({ type: z.literal("steam_investment_delete"), investmentId: recordId, refund: z.boolean().optional() }),
  z.object({ type: z.literal("steam_investment_topup"), investmentId: recordId, amount: positive, from: name.optional() }),
  z.object({ type: z.literal("steam_investment_received"), investmentId: recordId, received: z.string().trim().min(1).max(20) }),
  z.object({ type: z.literal("steam_withdrawal"), steamAccount: name, spent: positive, received: positive, to: name.optional(), note, date }),
  z.object({ type: z.literal("steam_withdrawal_delete"), withdrawalId: recordId }),
  // "Заморожені бабки": any entry, by title or id.
  z.object({ type: z.literal("expected_receive"), entry: name, amount: positive.optional(), to: name.optional(), source: name.optional(), date }),
  z.object({ type: z.literal("expected_update"), entry: name, title: name.optional(), amount: positive.optional(), status: z.nativeEnum(ExpectedMoneyStatus).optional(), note }),
  z.object({ type: z.literal("expected_delete"), entry: name }),
  // Any row of any table, exactly as given - no balance is moved (see lib/agent-raw.ts).
  z.object({ type: z.literal("raw_create"), table: name, data: z.record(z.unknown()) }),
  z.object({ type: z.literal("raw_update"), table: name, id: recordId, data: z.record(z.unknown()) }),
  z.object({ type: z.literal("raw_delete"), table: name, id: recordId })
]);

export type AgentOperation = z.infer<typeof agentOperationSchema>;

export type AgentOperationResult = {
  /** What was done, as the bot would say it. */
  receipt: string;
  /** Pass back as `{"type":"undo","ref":...}` to take it back. */
  undo: string | null;
};

/** A refusal meant for the agent: the route answers 409 with the message instead of a 500. */
export class AgentOperationError extends Error {}

function plain(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
}

function result(operation: OperationResult): AgentOperationResult {
  // encodeUndoRef gives the bot's `u:kind:id`; the agent passes back just `kind:id`.
  return { receipt: plain(operation.text), undo: operation.undo ? encodeUndoRef(operation.undo).slice(2) : null };
}

function done(receipt: string): AgentOperationResult {
  return { receipt, undo: null };
}

function byName<T extends { name: string }>(items: T[], value: string, label: string): T {
  const target = value.trim().toLowerCase();
  const found = items.find((item) => item.name.toLowerCase() === target);
  if (!found) throw new AgentOperationError(`${label} «${value}» не знайдено. Є: ${items.map((item) => item.name).join(", ") || "нічого"}`);
  return found;
}

function account(data: ReferenceData, value: string): Account {
  return byName(data.accounts, value, "Рахунок");
}

function defaultAccount(found: Account | null, currencyCode: string): Account {
  if (!found) throw new AgentOperationError(`Немає активного рахунку ${currencyCode}`);
  return found;
}

/** The bot remembers the last accounts per Telegram user; the agent falls back to the same defaults. */
async function sessionFor(userId: string): Promise<TelegramSession> {
  const session = await prisma.telegramSession.findFirst({ where: { userId }, orderBy: { updatedAt: "desc" } });
  return (session ?? {
    lastCategoryId: null,
    lastIncomeSourceId: null,
    lastExpenseAccountId: null,
    lastIncomeAccountUah: null,
    lastIncomeAccountUsdt: null,
    lastIncomeAccountUsd: null
  }) as TelegramSession;
}

async function deleteTransaction(userId: string, transactionId: string, permanent: boolean): Promise<AgentOperationResult> {
  const transaction = await prisma.transaction.findFirst({ where: { id: transactionId, userId } });
  if (!transaction) throw new AgentOperationError("Операцію не знайдено");
  const metadata = transaction.metadata && typeof transaction.metadata === "object" && !Array.isArray(transaction.metadata)
    ? (transaction.metadata as Record<string, unknown>)
    : {};
  // A flip or an FX trade owns its ledger row: removing only the row would leave it in the statistics.
  if (typeof metadata.flipId === "string") await undoFlipWithLedger(userId, metadata.flipId);
  else if (typeof metadata.fxTradeId === "string") await deleteFxTradeWithLedger(userId, { id: metadata.fxTradeId, externalId: null });
  else if (!permanent) await ledger.archiveTransaction(userId, transaction.id);
  if (permanent) await ledger.deleteTransactionPermanently(userId, transaction.id);
  return done(permanent ? "Операцію видалено назавжди, баланс повернуто." : "Операцію перенесено в архів, баланс повернуто.");
}

export async function runAgentOperation(userId: string, input: AgentOperation): Promise<AgentOperationResult> {
  const data = await loadReferenceData(userId);
  const transactionDate = "date" in input && input.date ? resolveTransactionDate(input.date) : undefined;

  switch (input.type) {
    case "expense":
    case "work_expense": {
      const isWork = input.type === "work_expense";
      const code = (input.currency ?? (isWork ? "USDT" : "UAH")) as TelegramCurrency;
      const from = input.account ? account(data, input.account) : defaultAccount(pickExpenseAccount(data, await sessionFor(userId), code), code);
      const category = input.type === "expense" ? byName(data.categories, input.category, "Категорію") : null;
      const direction = input.type === "work_expense" ? byName(data.incomeSources, input.direction, "Напрямок") : null;
      return result(await submitExpense(userId, {
        amount: input.amount,
        currency: code,
        accountId: from.id,
        categoryId: category?.id ?? null,
        incomeSourceId: direction?.id ?? null,
        note: input.note ?? null,
        date: transactionDate,
        isWorkExpense: isWork
      }, data));
    }
    case "income": {
      const code = (input.currency ?? "UAH") as TelegramCurrency;
      const to = input.account ? account(data, input.account) : defaultAccount(pickIncomeAccount(data, await sessionFor(userId), code), code);
      const source = byName(data.incomeSources, input.source, "Джерело");
      return result(await submitIncome(userId, { amount: input.amount, currency: code, accountId: to.id, incomeSourceId: source.id, note: input.note ?? null, date: transactionDate }, data));
    }
    case "transfer":
      return result(await submitTransfer(userId, {
        amount: input.amount,
        fromAccountId: account(data, input.from).id,
        toAccountId: account(data, input.to).id,
        note: input.note ?? null,
        date: transactionDate
      }, data));
    case "savings": {
      const from = input.from ? account(data, input.from) : defaultAccount(pickExpenseAccount(data, await sessionFor(userId), "UAH"), "UAH");
      return result(await submitSavings(userId, { amount: input.amount, accountId: from.id, note: input.note ?? null, date: transactionDate }, data));
    }
    case "p2p":
      return result(await submitP2P(userId, { receivedUah: input.receivedUah, rateUahPerUsdt: input.rate, note: input.note ?? null, date: transactionDate }, data));
    case "p2p_deposit":
      return result(await submitP2PDeposit(userId, { spentUah: input.spentUah, rateUahPerUsdt: input.rate, note: input.note ?? null, date: transactionDate }, data));
    case "cash":
      return result(await submitCash(userId, {
        receivedAmount: input.receivedAmount,
        receivedCurrency: input.currency ?? "UAH",
        rate: input.rate,
        place: input.place ?? null,
        date: transactionDate
      }, data));
    case "expected":
      return result(await submitExpectedMoney(userId, { amount: input.amount, currency: (input.currency ?? "USDT") as TelegramCurrency, title: input.title ?? null }));
    case "freeze": {
      const code = (input.currency ?? "USDT") as TelegramCurrency;
      const from = input.account ? account(data, input.account) : defaultAccount(pickExpenseAccount(data, await sessionFor(userId), code), code);
      return result(await submitFreeze(userId, { amount: input.amount, accountId: from.id, title: input.title ?? null, date: transactionDate }, data));
    }
    case "unfreeze": {
      const entries = await loadFrozenFromAccounts(userId);
      const target = input.entry.trim().toLowerCase();
      const matches = entries.filter((entry) => entry.id === input.entry || entry.title.toLowerCase() === target);
      if (!matches.length) throw new AgentOperationError(`Заморожений запис «${input.entry}» не знайдено. Є: ${entries.map((entry) => entry.title).join(", ") || "нічого"}`);
      if (matches.length > 1) throw new AgentOperationError(`Записів «${input.entry}» кілька — передай id: ${matches.map((entry) => entry.id).join(", ")}`);
      return result(await submitUnfreeze(userId, { expectedMoneyId: matches[0].id }));
    }
    case "flip":
      return result(await submitFlip(userId, { pnl: input.pnl, setup: input.setup, date: transactionDate }));
    case "set_balance":
      return result(await submitManualAdjustment(userId, { accountId: account(data, input.account).id, newBalance: input.balance }, data));
    case "steam_investment": {
      const wallet = await findSteamAccount(userId, input.steamAccount);
      if (!wallet) throw new AgentOperationError(`Steam-акаунт «${input.steamAccount}» не знайдено`);
      const from = input.from ? account(data, input.from) : defaultAccount(pickExpenseAccount(data, await sessionFor(userId), "USDT"), "USDT");
      const received = input.received ? resolveReceivedAmount(input.received, input.amount) : "0";
      if (received === null) throw new AgentOperationError("received: сума в $ або бонус, напр. +32%");
      return result(await submitSteamInvestment(userId, { resaleAccountId: wallet.id, sourceAccountId: from.id, amount: input.amount, received, date: transactionDate }, data));
    }
    case "create_steam_account": {
      const created = await steamResale.createAccount(userId, { name: input.name, currentSoftwareBalance: input.balance ?? "0" });
      return done(`Steam-акаунт «${created.name}» додано, баланс ${created.currentSoftwareBalance.toString()} USD.`);
    }
    case "undo": {
      const ref = decodeUndoRef(`u:${input.ref}`);
      if (!ref) throw new AgentOperationError("ref має вигляд tx:<id>, flip:<id>, expected:<id> або steamin:<id>");
      const outcome = await performUndo(userId, ref, prismaUndoGateway);
      if (outcome === "missing" || outcome === "failed") throw new AgentOperationError(undoMessage(outcome));
      return done(undoMessage(outcome));
    }
    case "delete":
      return deleteTransaction(userId, input.transactionId, input.permanent === true);
    case "restore":
      await ledger.restoreTransaction(userId, input.transactionId);
      return done("Операцію відновлено з архіву, баланс застосовано знову.");
    case "create_account": {
      const created = await ledger.createAccount(userId, {
        type: input.accountType,
        name: input.name,
        currency: input.currency,
        initialBalance: input.balance ?? "0",
        isReserved: input.isReserved
      });
      return done(`Рахунок «${created.name}» (${created.type}, ${created.currency}) створено з балансом ${created.currentBalance.toString()}.`);
    }
    case "update_account": {
      const current = byName(await prisma.account.findMany({ where: { userId } }), input.account, "Рахунок");
      const updated = await prisma.account.update({
        where: { id: current.id },
        data: { name: input.name, isReserved: input.isReserved, isActive: input.isActive }
      });
      return done(`Рахунок «${updated.name}»: ${updated.isActive ? "активний" : "вимкнений"}, ${updated.isReserved ? "відкладений" : "звичайний"}.`);
    }
    case "create_category": {
      const last = await prisma.category.findFirst({ where: { userId }, orderBy: { sortOrder: "desc" } });
      const item = await prisma.category.upsert({
        where: { userId_name: { userId, name: input.name } },
        update: { isActive: true },
        create: { userId, name: input.name, sortOrder: (last?.sortOrder ?? -1) + 1 }
      });
      return done(`Категорію «${item.name}» додано.`);
    }
    case "create_source": {
      const item = await prisma.incomeSource.upsert({
        where: { userId_name: { userId, name: input.name } },
        update: { isActive: true },
        create: { userId, name: input.name }
      });
      return done(`Джерело «${item.name}» додано.`);
    }
    case "update_category": {
      const current = byName(await prisma.category.findMany({ where: { userId } }), input.category, "Категорію");
      const item = await prisma.category.update({ where: { id: current.id }, data: { name: input.name, isActive: input.isActive } });
      return done(`Категорія «${item.name}»: ${item.isActive ? "активна" : "вимкнена"}.`);
    }
    case "update_source": {
      const current = byName(await prisma.incomeSource.findMany({ where: { userId } }), input.source, "Джерело");
      const item = await prisma.incomeSource.update({ where: { id: current.id }, data: { name: input.name, isActive: input.isActive } });
      return done(`Джерело «${item.name}»: ${item.isActive ? "активне" : "вимкнене"}.`);
    }
    case "update_settings": {
      const settings = await prisma.settings.update({
        where: { userId },
        data: {
          monthlyExpenseLimit: input.monthlyExpenseLimit,
          // The site keeps its colour thresholds equal to the limit; so does the agent.
          greenMax: input.monthlyExpenseLimit,
          yellowMax: input.monthlyExpenseLimit,
          rateMode: input.rateMode,
          manualUahUsdtRate: input.manualRate,
          hideAmounts: input.hideAmounts
        }
      });
      return done(
        `Налаштування: ліміт ${settings.monthlyExpenseLimit?.toString() ?? "—"} UAH, курс ${settings.rateMode}${settings.manualUahUsdtRate ? ` (${settings.manualUahUsdtRate.toString()})` : ""}, суми ${settings.hideAmounts ? "приховані" : "видно"}.`
      );
    }
    case "steam_round_create": {
      const schemes = await prisma.steamArbitrageScheme.findMany({ where: { userId, archivedAt: null, isActive: true } });
      const scheme = byName(schemes, input.scheme, "Схему");
      const from = input.from ? account(data, input.from) : defaultAccount(pickExpenseAccount(data, await sessionFor(userId), "USDT"), "USDT");
      const round = await steamArbitrage.createRound(userId, {
        schemeId: scheme.id,
        siteName: input.site ?? null,
        sourceAccountId: from.id,
        investedAmount: input.amount,
        startedAt: transactionDate ?? new Date()
      });
      return { receipt: `Круг «${scheme.name}» на ${round.investedAmount.toString()} USDT відкрито, гроші взято з «${from.name}». id: ${round.id}`, undo: null };
    }
    case "steam_round_complete": {
      const to = input.to ? account(data, input.to) : defaultAccount(pickIncomeAccount(data, await sessionFor(userId), "USDT"), "USDT");
      const round = await steamArbitrage.completeRound(userId, {
        roundId: input.roundId,
        destinationAccountId: to.id,
        finalAmountReceived: input.received,
        remainingAmount: input.remaining ?? "0",
        completedAt: transactionDate ?? new Date(),
        note: input.note ?? null
      });
      return done(`Круг завершено: вкладено ${round.investedAmount.toString()} USDT, отримано ${round.finalAmountReceived?.toString() ?? "0"} USDT на «${to.name}».`);
    }
    case "steam_round_delete": {
      const round = await deleteSteamRound(userId, input.roundId, { refund: input.refund });
      return done(
        input.refund === false
          ? `Круг «${round.scheme.name}» на ${round.investedAmount.toString()} USDT видалено, баланси не чіпав.`
          : `Круг «${round.scheme.name}» видалено, ${round.investedAmount.toString()} USDT повернуто на рахунок.`
      );
    }
    case "steam_scheme_create": {
      const scheme = await steamArbitrage.createScheme(userId, { name: input.name });
      return done(`Схему «${scheme.name}» додано.`);
    }
    case "steam_investment_delete": {
      const outcome = await undoSteamInvestment(userId, input.investmentId, { refund: input.refund });
      if (outcome === "missing") throw new AgentOperationError("Завоз не знайдено");
      if (outcome === "already") throw new AgentOperationError("Цей завоз уже видалено");
      return done(input.refund === false ? "Завоз видалено, реальні гроші не повертав." : "Завоз видалено, реальні гроші повернуто на рахунок, зі Steam знято те, що зайшло.");
    }
    case "steam_investment_topup": {
      const from = input.from ? account(data, input.from) : defaultAccount(pickExpenseAccount(data, await sessionFor(userId), "USDT"), "USDT");
      const investment = await steamResale.addInvestmentAmount(userId, { investmentId: input.investmentId, sourceAccountId: from.id, extraExternalAmount: input.amount });
      return done(`Завоз доповнено на ${input.amount} USDT з «${from.name}», разом ${investment.externalAmount.toString()} USDT.`);
    }
    case "steam_investment_received": {
      const current = await prisma.steamResaleInvestment.findFirst({ where: { id: input.investmentId, userId, archivedAt: null } });
      if (!current) throw new AgentOperationError("Завоз не знайдено");
      const received = resolveReceivedAmount(input.received, current.externalAmount.toString());
      if (received === null) throw new AgentOperationError("received: сума в $ або бонус, напр. +32%");
      const investment = await steamResale.updateInvestmentReceived(userId, { investmentId: current.id, receivedSteamAmount: received });
      return done(`У завозі тепер зайшло ${investment.receivedSteamAmount.toString()} USD з ${investment.externalAmount.toString()} USDT.`);
    }
    case "steam_withdrawal": {
      const wallet = await findSteamAccount(userId, input.steamAccount);
      if (!wallet) throw new AgentOperationError(`Steam-акаунт «${input.steamAccount}» не знайдено`);
      const to = input.to ? account(data, input.to) : defaultAccount(pickIncomeAccount(data, await sessionFor(userId), "USDT"), "USDT");
      const withdrawal = await steamResale.createWithdrawal(userId, {
        resaleAccountId: wallet.id,
        destinationAccountId: to.id,
        softwareAmountSpent: input.spent,
        amountReceived: input.received,
        withdrawalDate: transactionDate ?? new Date(),
        note: input.note ?? null
      });
      return done(`Вивід зі Steam «${wallet.name}»: списано ${withdrawal.softwareAmountSpent.toString()} USD, отримано ${withdrawal.amountReceived.toString()} USDT на «${to.name}». id: ${withdrawal.id}`);
    }
    case "steam_withdrawal_delete": {
      const withdrawal = await deleteSteamWithdrawal(userId, input.withdrawalId);
      return done(`Вивід видалено: ${withdrawal.amountReceived.toString()} USDT знято з рахунку, ${withdrawal.softwareAmountSpent.toString()} USD повернуто на Steam.`);
    }
    case "expected_receive": {
      const entry = await expectedEntry(userId, input.entry, true);
      // Money frozen out of an own account goes back as it left, never as income.
      if (entry.sourceAccountId) return result(await submitUnfreeze(userId, { expectedMoneyId: entry.id }));
      const code = entry.currency as TelegramCurrency;
      const to = input.to ? account(data, input.to) : defaultAccount(pickIncomeAccount(data, await sessionFor(userId), code), code);
      const sourceName = input.source ?? RETURNED_FROZEN_SOURCE;
      const source = await prisma.incomeSource.upsert({
        where: { userId_name: { userId, name: sourceName } },
        update: { isActive: true },
        create: { userId, name: sourceName }
      });
      const transaction = await ledger.receiveExpectedMoney(userId, {
        expectedMoneyId: entry.id,
        actualAmount: input.amount ?? entry.amount.toString(),
        destinationAccountId: to.id,
        incomeSourceId: source.id,
        transactionDate
      });
      return { receipt: `«${entry.title}» отримано: ${transaction.amount.toString()} ${transaction.currency} на «${to.name}».`, undo: `tx:${transaction.id}` };
    }
    case "expected_update": {
      const entry = await expectedEntry(userId, input.entry, false);
      const closed = input.status ? !ACTIVE_EXPECTED_STATUSES.includes(input.status) : null;
      const updated = await prisma.expectedMoney.update({
        where: { id: entry.id },
        data: {
          title: input.title,
          amount: input.amount,
          status: input.status,
          note: input.note === undefined ? undefined : input.note,
          resolvedAt: closed === null ? undefined : closed ? new Date() : null
        }
      });
      return done(`«${updated.title}»: ${updated.amount.toString()} ${updated.currency}, статус ${updated.status}.`);
    }
    case "expected_delete": {
      const entry = await expectedEntry(userId, input.entry, false);
      if (entry.sourceAccountId && ACTIVE_EXPECTED_STATUSES.includes(entry.status)) {
        // Still frozen out of an account: undo the freeze so the money is not lost with the entry.
        const freeze = await prisma.transaction.findFirst({
          where: { userId, type: "FUNDS_FROZEN", archivedAt: null, metadata: { path: ["expectedMoneyId"], equals: entry.id } }
        });
        if (freeze) {
          await ledger.archiveTransaction(userId, freeze.id);
          return done(`«${entry.title}» видалено, ${entry.amount.toString()} ${entry.currency} повернуто на рахунок.`);
        }
      }
      await prisma.expectedMoney.delete({ where: { id: entry.id } });
      return done(`«${entry.title}» видалено.`);
    }
    case "raw_create": {
      const row = await rawCreate(userId, { table: input.table, data: input.data });
      return { receipt: `Запис у ${input.table} створено. id: ${String(row.id ?? "")}`, undo: null };
    }
    case "raw_update":
      await rawUpdate(userId, { table: input.table, id: input.id, data: input.data });
      return done(`Запис ${input.id} у ${input.table} змінено. Баланси не перераховувались.`);
    case "raw_delete":
      await rawDelete(userId, { table: input.table, id: input.id });
      return done(`Запис ${input.id} з ${input.table} видалено. Баланси не перераховувались.`);
  }
}

const RETURNED_FROZEN_SOURCE = "Повернення заморожених";

async function expectedEntry(userId: string, value: string, activeOnly: boolean) {
  const entries = await prisma.expectedMoney.findMany({
    where: { userId, ...(activeOnly ? { status: { in: ACTIVE_EXPECTED_STATUSES } } : {}) },
    orderBy: { createdAt: "asc" }
  });
  const target = value.trim().toLowerCase();
  const matches = entries.filter((entry) => entry.id === value || entry.title.toLowerCase() === target);
  if (!matches.length) throw new AgentOperationError(`Запис «${value}» не знайдено. Є: ${entries.map((entry) => entry.title).join(", ") || "нічого"}`);
  if (matches.length > 1) throw new AgentOperationError(`Записів «${value}» кілька — передай id: ${matches.map((entry) => entry.id).join(", ")}`);
  return matches[0];
}

/**
 * Turns a failure into what the agent should hear. Anything it can fix itself (unknown name,
 * not enough money, a duplicate, a field the table does not have) gets a status and a
 * message; a real server fault returns null and stays a 500.
 */
export function agentRefusal(error: unknown): { status: number; message: string } | null {
  if (error instanceof RawAccessError) return { status: error.status, message: error.message };
  if (error instanceof AgentOperationError) return { status: 409, message: error.message };
  if (error instanceof Prisma.PrismaClientValidationError) {
    // The last lines say which field is wrong; the rest is the query echoed back.
    return { status: 422, message: error.message.trim().split("\n").filter(Boolean).slice(-2).join(" ").slice(0, 400) };
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return { status: 409, message: "Такий запис уже є (унікальне поле повторюється)" };
    if (error.code === "P2003") return { status: 409, message: "На цей запис посилаються інші — спершу прибери їх" };
    if (error.code === "P2025") return { status: 404, message: "Запис не знайдено" };
    return null;
  }
  if (!(error instanceof Error)) return null;
  const message = error.message.trim();
  // Ledger and Steam refusals are one short sentence; driver noise is not.
  if (!message || message.length > 200 || /prisma|ECONN|fetch failed|timeout/i.test(message)) return null;
  return { status: 409, message };
}
