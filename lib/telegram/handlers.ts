import type { TelegramSession } from "@prisma/client";
import { D } from "@/lib/money";
import {
  answerCallbackQuery,
  editMessageReplyMarkup,
  editMessageText,
  sendMessage
} from "@/lib/telegram/api";
import { BOT_COMMANDS, parseCommand } from "@/lib/telegram/commands";
import type { TelegramConfig } from "@/lib/telegram/config";
import { dateLabel, kyivToday, parseTypedDate, resolveTransactionDate } from "@/lib/telegram/dates";
import { escapeHtml, formatAmount, truncate } from "@/lib/telegram/format";
import {
  CALLBACK,
  cancelButton,
  cancelKeyboard,
  changeAccountButton,
  changeDateButton,
  mainReplyKeyboard,
  matchMenuLabel,
  menuKeyboard,
  menuText,
  optionKeyboard,
  optionLabel,
  undoKeyboard
} from "@/lib/telegram/keyboards";
import {
  parseCashEntry,
  parseExpectedEntry,
  parseFlipEntry,
  parseP2PEntry,
  parseQuickEntry
} from "@/lib/telegram/parse";
import type { TelegramCurrency } from "@/lib/telegram/parse";
import {
  accountLabel,
  accountsForCurrency,
  fallbackReference,
  findAccountById,
  findCategory,
  findIncomeSource,
  formatBalances,
  loadFlipSetups,
  loadReferenceData,
  pickExpenseAccount,
  pickIncomeAccount,
  prismaUndoGateway,
  resolveFeelkyUserId,
  savingsSourceAccounts,
  submitCash,
  submitExpectedMoney,
  submitExpense,
  submitFlip,
  submitIncome,
  submitManualAdjustment,
  submitP2P,
  submitSavings
} from "@/lib/telegram/operations";
import type { OperationResult, ReferenceData } from "@/lib/telegram/operations";
import {
  clearFlow,
  incomeAccountPatch,
  loadTelegramSession,
  readDraft,
  rememberSelections,
  saveFlow,
  setDraftMessageId
} from "@/lib/telegram/session";
import type { Draft, FlowAction, FlowStep, RememberedSelections } from "@/lib/telegram/session";
import { isAllowedTelegramUser, isPrivateChat } from "@/lib/telegram/security";
import type {
  InlineKeyboardButton,
  InlineKeyboardMarkup,
  ReplyMarkup,
  TelegramCallbackQuery,
  TelegramIncomingMessage,
  TelegramUpdatePayload
} from "@/lib/telegram/types";
import { decodeUndoRef, performUndo, undoMessage } from "@/lib/telegram/undo";

const GENERIC_ERROR = "Щось пішло не так. Спробуй ще раз або відкрий /menu.";
const ACCESS_DENIED = "Доступ заборонено.";

type Ctx = {
  config: TelegramConfig;
  userId: string;
  chatId: number;
  telegramUserId: number;
  session: TelegramSession;
  data: ReferenceData;
  /** Message the scenario is drawn in; steps edit it instead of posting new ones. */
  messageId: number | null;
};

function logError(scope: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[telegram] ${scope}: ${message}`);
  if (error instanceof Error && error.stack) console.error(error.stack);
}

/** User facing errors coming out of the ledger are already short and Ukrainian; anything else stays generic. */
function userFacingError(error: unknown): string {
  if (!(error instanceof Error)) return GENERIC_ERROR;
  const message = error.message.trim();
  if (!message || message.length > 160) return GENERIC_ERROR;
  if (/prisma|invalid|constraint|column|relation|ECONN|fetch/i.test(message)) return GENERIC_ERROR;
  return message;
}

function isNotModified(error: unknown): boolean {
  return error instanceof Error && /message is not modified/i.test(error.message);
}

/** A scenario step: rewrites the current bubble so the chat never fills up with options. */
async function reply(ctx: Ctx, text: string, replyMarkup?: InlineKeyboardMarkup): Promise<void> {
  if (ctx.messageId !== null) {
    try {
      await editMessageText(ctx.config.botToken, ctx.chatId, ctx.messageId, text, replyMarkup);
      return;
    } catch (error) {
      if (isNotModified(error)) return;
      logError("editMessageText", error);
    }
  }
  const sent = await sendMessage(ctx.config.botToken, ctx.chatId, text, { replyMarkup });
  ctx.messageId = sent.message_id;
  await setDraftMessageId(ctx.telegramUserId, sent.message_id).catch((error) => logError("setDraftMessageId", error));
}

/** Something outside a scenario (menu, balances, undo, errors): always its own message. */
async function sendNew(ctx: Ctx, text: string, replyMarkup?: ReplyMarkup): Promise<void> {
  await sendMessage(ctx.config.botToken, ctx.chatId, text, { replyMarkup });
  ctx.messageId = null;
}

/** Terminal message that also ends the scenario. */
async function endFlow(ctx: Ctx, text: string, replyMarkup?: InlineKeyboardMarkup): Promise<void> {
  await reply(ctx, text, replyMarkup);
  await clearFlow(ctx.telegramUserId);
  ctx.messageId = null;
}

async function sendSafely(config: TelegramConfig, chatId: number, text: string, replyMarkup?: ReplyMarkup) {
  try {
    await sendMessage(config.botToken, chatId, text, { replyMarkup });
  } catch (error) {
    logError("sendMessage", error);
  }
}

export async function handleTelegramUpdate(update: TelegramUpdatePayload, config: TelegramConfig): Promise<void> {
  if (update.message) return handleMessage(update.message, config);
  if (update.callback_query) return handleCallbackQuery(update.callback_query, config);
}

async function buildContext(
  config: TelegramConfig,
  telegramUserId: number,
  chatId: number,
  callbackMessageId: number | null
): Promise<Ctx | null> {
  const userId = await resolveFeelkyUserId(config.userEmail);
  if (!userId) {
    console.error("[telegram] TELEGRAM_USER_EMAIL does not match any Feelky user");
    await sendSafely(config, chatId, "Бот ще не підключено до акаунта Feelky.");
    return null;
  }
  const [session, data] = await Promise.all([
    loadTelegramSession(userId, telegramUserId, chatId),
    loadReferenceData(userId)
  ]);
  const draft = readDraft(session);
  return {
    config,
    userId,
    chatId,
    telegramUserId,
    session,
    data,
    messageId: callbackMessageId ?? draft.messageId ?? null
  };
}

async function handleMessage(message: TelegramIncomingMessage, config: TelegramConfig) {
  const telegramUserId = message.from?.id;
  if (!isPrivateChat(message.chat.type)) {
    console.warn("[telegram] ignored non-private chat update");
    return;
  }
  if (!isAllowedTelegramUser(telegramUserId, config.allowedUserIds)) {
    console.warn(`[telegram] rejected message from telegram user ${telegramUserId ?? "unknown"}`);
    await sendSafely(config, message.chat.id, ACCESS_DENIED);
    return;
  }
  const text = (message.text || "").trim();
  const ctx = await buildContext(config, telegramUserId as number, message.chat.id, null);
  if (!ctx) return;
  if (!text) {
    await reply(ctx, "Надішли текст або обери дію в /menu.");
    return;
  }

  try {
    const command = parseCommand(text);
    if (command) {
      await handleCommand(ctx, command.command, command.args);
      return;
    }
    const tapped = matchMenuLabel(text);
    if (tapped) {
      await handleMenuAction(ctx, tapped);
      return;
    }
    if (ctx.session.action && ctx.session.step) {
      await handleFlowMessage(ctx, ctx.session.action as FlowAction, ctx.session.step as FlowStep, text);
      return;
    }
    await handleQuickEntry(ctx, text);
  } catch (error) {
    logError("handleMessage", error);
    await clearFlow(ctx.telegramUserId).catch((nested) => logError("clearFlow", nested));
    await sendSafely(config, ctx.chatId, userFacingError(error), menuKeyboard());
  }
}

async function handleCallbackQuery(callback: TelegramCallbackQuery, config: TelegramConfig) {
  const telegramUserId = callback.from?.id;
  const chatId = callback.message?.chat.id;
  if (!callback.message || typeof chatId !== "number") return;
  if (!isPrivateChat(callback.message.chat.type)) return;
  if (!isAllowedTelegramUser(telegramUserId, config.allowedUserIds)) {
    console.warn(`[telegram] rejected callback from telegram user ${telegramUserId ?? "unknown"}`);
    await answerCallbackQuery(config.botToken, callback.id, ACCESS_DENIED, true).catch((error) =>
      logError("answerCallbackQuery", error)
    );
    return;
  }

  let answer = "";
  try {
    const ctx = await buildContext(config, telegramUserId as number, chatId, callback.message.message_id);
    if (!ctx) return;
    answer = await routeCallback(ctx, callback, (callback.data || "").trim());
  } catch (error) {
    logError("handleCallbackQuery", error);
    answer = userFacingError(error);
    await sendSafely(config, chatId, answer, menuKeyboard());
  } finally {
    await answerCallbackQuery(config.botToken, callback.id, answer || undefined).catch((error) =>
      logError("answerCallbackQuery", error)
    );
  }
}

async function routeCallback(ctx: Ctx, callback: TelegramCallbackQuery, data: string): Promise<string> {
  if (!data || data === CALLBACK.noop) return "";

  const undoRef = decodeUndoRef(data);
  if (undoRef) {
    const outcome = await performUndo(ctx.userId, undoRef, prismaUndoGateway);
    if (outcome === "undone" && callback.message) {
      await editMessageReplyMarkup(ctx.config.botToken, ctx.chatId, callback.message.message_id).catch((error) =>
        logError("editMessageReplyMarkup", error)
      );
    }
    await sendNew(ctx, undoMessage(outcome));
    return undoMessage(outcome);
  }

  if (data.startsWith("m:")) {
    await handleMenuAction(ctx, data.slice(2));
    return "";
  }

  if (data === CALLBACK.changeAccount) {
    const action = ctx.session.action as FlowAction | null;
    if (!action) return "Дія вже неактуальна.";
    const draft = readDraft(ctx.session);
    delete draft.accountId;
    await promptAccount(ctx, action, draft);
    return "";
  }

  if (data === CALLBACK.changeDate) {
    const action = ctx.session.action as FlowAction | null;
    const step = ctx.session.step as FlowStep | null;
    if (!action || !step) return "Дія вже неактуальна.";
    await promptDate(ctx, action, readDraft(ctx.session), step);
    return "";
  }

  if (data === CALLBACK.today) {
    const action = ctx.session.action as FlowAction | null;
    if (!action || ctx.session.step !== "date") return "Дія вже неактуальна.";
    const draft = readDraft(ctx.session);
    delete draft.date;
    const back = draft.returnStep || "note";
    delete draft.returnStep;
    await renderStep(ctx, action, back, draft);
    return "";
  }

  if (data === CALLBACK.skipNote) {
    const action = ctx.session.action as FlowAction | null;
    if (!action || ctx.session.step !== "note") return "Дія вже неактуальна.";
    const draft = readDraft(ctx.session);
    draft.note = null;
    await advance(ctx, action, draft);
    return "";
  }

  if (data.startsWith(`${CALLBACK.option}:`)) {
    return handleOptionCallback(ctx, data.slice(CALLBACK.option.length + 1));
  }

  return "Дія вже неактуальна.";
}

async function handleOptionCallback(ctx: Ctx, rawIndex: string): Promise<string> {
  const action = ctx.session.action as FlowAction | null;
  const step = ctx.session.step as FlowStep | null;
  if (!action || !step) return "Дія вже завершена.";
  const draft = readDraft(ctx.session);
  const index = Number(rawIndex);
  const options = draft.options || [];
  if (!Number.isInteger(index) || index < 0 || index >= options.length) return "Кнопка застаріла. Відкрий /menu.";
  const id = options[index];

  if (step === "account") {
    // Ownership is re-checked against the database, callback data is never trusted on its own.
    const account = findAccountById(ctx.data.accounts, id);
    if (!account) return "Рахунок не знайдено.";
    draft.accountId = account.id;
    delete draft.options;
    await advance(ctx, action, draft);
    return "";
  }
  if (step === "category") {
    const category = ctx.data.categories.find((item) => item.id === id);
    if (!category) return "Категорію не знайдено.";
    draft.categoryId = category.id;
    delete draft.options;
    await advance(ctx, action, draft);
    return "";
  }
  if (step === "source") {
    const source = ctx.data.incomeSources.find((item) => item.id === id);
    if (!source) return "Джерело не знайдено.";
    draft.incomeSourceId = source.id;
    delete draft.options;
    await advance(ctx, action, draft);
    return "";
  }
  if (step === "setup") {
    draft.setup = id;
    delete draft.options;
    await advance(ctx, action, draft);
    return "";
  }
  return "Дія вже неактуальна.";
}

async function handleMenuAction(ctx: Ctx, action: string): Promise<void> {
  if (action === "menu") {
    await clearFlow(ctx.telegramUserId);
    await sendNew(ctx, menuText(), mainReplyKeyboard());
    return;
  }
  if (action === "cancel") {
    await clearFlow(ctx.telegramUserId);
    await sendNew(ctx, "Скасовано.", mainReplyKeyboard());
    return;
  }
  if (action === "balance") {
    await sendNew(ctx, await formatBalances(ctx.userId));
    return;
  }
  const flow = toFlowAction(action);
  if (!flow) {
    await reply(ctx, "Невідома дія.", menuKeyboard());
    return;
  }
  await startFlow(ctx, flow);
}

function toFlowAction(value: string): FlowAction | null {
  const actions: FlowAction[] = ["expense", "income", "work", "savings", "p2p", "cash", "expected", "flip", "manual"];
  return actions.includes(value as FlowAction) ? (value as FlowAction) : null;
}

async function handleCommand(ctx: Ctx, command: string, args: string): Promise<void> {
  if (command === "start" || command === "menu") {
    await clearFlow(ctx.telegramUserId);
    await sendNew(ctx, menuText(), mainReplyKeyboard());
    return;
  }
  if (command === "help") {
    await sendNew(ctx, helpText());
    return;
  }
  if (command === "cancel") {
    await clearFlow(ctx.telegramUserId);
    await sendNew(ctx, "Скасовано.", mainReplyKeyboard());
    return;
  }
  if (command === "balance" || command === "accounts") {
    await sendNew(ctx, await formatBalances(ctx.userId));
    return;
  }
  const flow = toFlowAction(command);
  if (!flow) {
    await reply(ctx, "Невідома команда. Відкрий /menu або /help.", menuKeyboard());
    return;
  }
  await startFlow(ctx, flow, args);
}

async function startFlow(ctx: Ctx, action: FlowAction, args = ""): Promise<void> {
  const draft: Draft = {};
  await saveFlow(ctx.telegramUserId, { action, step: firstStep(action), draft });
  if (args) {
    ctx.session = await refreshSession(ctx);
    await handleFlowMessage(ctx, action, firstStep(action), args);
    return;
  }
  await promptFirstStep(ctx, action, draft);
}

function firstStep(action: FlowAction): FlowStep {
  if (action === "manual") return "account";
  if (action === "p2p" || action === "cash" || action === "expected") return "input";
  return "amount";
}

async function refreshSession(ctx: Ctx): Promise<TelegramSession> {
  const session = await loadTelegramSession(ctx.userId, ctx.telegramUserId, ctx.chatId);
  ctx.session = session;
  return session;
}

async function promptFirstStep(ctx: Ctx, action: FlowAction, draft: Draft): Promise<void> {
  if (action === "manual") {
    await promptAccount(ctx, action, draft);
    return;
  }
  if (action === "p2p") {
    await reply(ctx, ["<b>P2P-вивід</b>", "Формат: <code>5000 41.25 Binance</code>", "отримано UAH · курс UAH/USDT · примітка"].join("\n"), stepKeyboard(ctx, action, draft));
    return;
  }
  if (action === "cash") {
    await reply(
      ctx,
      ["<b>Вивід у готівку</b>", "Формат: <code>10000 UAH 41.2 Cashalot</code>", "або <code>500 USD 1 Cashalot</code>"].join("\n"),
      stepKeyboard(ctx, action, draft)
    );
    return;
  }
  if (action === "expected") {
    await reply(
      ctx,
      ["<b>Очікувані/заморожені гроші</b>", "Формат: <code>250 USDT холд біржі</code>", "без валюти сума рахується як USDT"].join("\n"),
      cancelKeyboard()
    );
    return;
  }
  await promptAmount(ctx, action, draft);
}

async function promptAmount(ctx: Ctx, action: FlowAction, draft: Draft): Promise<void> {
  const titles: Record<string, string> = {
    expense: "<b>Витрата</b>\nСума? Напр. <code>250</code> або <code>20 USDT</code>",
    income: "<b>Дохід</b>\nСума? Напр. <code>1500 UAH</code> або <code>300 USDT</code>",
    work: "<b>Робоча витрата</b>\nСума? Напр. <code>20 USDT</code>",
    savings: "<b>Відкладення</b>\nСкільки відкласти в UAH? Напр. <code>1000</code>",
    flip: "<b>Фліп</b>\nPnL у USDT? Напр. <code>35.5</code> або <code>-12</code>"
  };
  delete draft.options;
  await saveFlow(ctx.telegramUserId, { action, step: "amount", draft });
  await reply(ctx, titles[action] || "Сума?", stepKeyboard(ctx, action, draft));
}

/** ExpectedMoney and manual balance corrections are always "now", so they get no date button. */
function supportsDate(action: FlowAction): boolean {
  return action !== "expected" && action !== "manual";
}

function stepExtraRows(ctx: Ctx, action: FlowAction, draft: Draft): InlineKeyboardButton[][] {
  const row: InlineKeyboardButton[] = [];
  const account = findAccountById(ctx.data.accounts, draft.accountId);
  if (account) row.push(changeAccountButton(account.name));
  if (supportsDate(action)) row.push(changeDateButton(dateLabel(draft.date || kyivToday())));
  return row.length ? [row] : [];
}

function stepKeyboard(ctx: Ctx, action: FlowAction, draft: Draft): InlineKeyboardMarkup {
  return { inline_keyboard: [...stepExtraRows(ctx, action, draft), [cancelButton()]] };
}

async function promptAccount(ctx: Ctx, action: FlowAction, draft: Draft): Promise<void> {
  const currency: TelegramCurrency = action === "savings" ? "UAH" : draft.currency || "UAH";
  const accounts =
    action === "manual"
      ? ctx.data.accounts
      : action === "savings"
        ? savingsSourceAccounts(ctx.data.accounts)
        : accountsForCurrency(ctx.data.accounts, currency);
  if (!accounts.length) {
    await endFlow(ctx, `Немає активного рахунку ${escapeHtml(currency)}.`);
    return;
  }
  draft.options = accounts.map((account) => account.id);
  await saveFlow(ctx.telegramUserId, { action, step: "account", draft });
  const title = action === "manual" ? "Який рахунок оновити?" : action === "savings" ? "Звідки відкласти?" : "Рахунок?";
  await reply(ctx, title, optionKeyboard(accounts.map((account) => optionLabel(accountLabel(account))), 1));
}

async function promptCategory(ctx: Ctx, action: FlowAction, draft: Draft, prefix?: string): Promise<void> {
  const categories = ctx.data.categories;
  if (!categories.length) {
    await endFlow(ctx, "Немає активних категорій. Створи їх на сайті Feelky.");
    return;
  }
  draft.options = categories.map((category) => category.id);
  await saveFlow(ctx.telegramUserId, { action, step: "category", draft });
  const title = prefix ? `${prefix}\nКатегорія?` : "Категорія?";
  await reply(ctx, title, optionKeyboard(categories.map((category) => optionLabel(category.name)), 2, stepExtraRows(ctx, action, draft)));
}

async function promptSource(ctx: Ctx, action: FlowAction, draft: Draft, prefix?: string): Promise<void> {
  const sources = ctx.data.incomeSources;
  if (!sources.length) {
    await endFlow(ctx, "Немає активних джерел доходу. Створи їх на сайті Feelky.");
    return;
  }
  draft.options = sources.map((source) => source.id);
  await saveFlow(ctx.telegramUserId, { action, step: "source", draft });
  const label = action === "work" ? "Напрямок доходу?" : "Джерело доходу?";
  const title = prefix ? `${prefix}\n${label}` : label;
  await reply(ctx, title, optionKeyboard(sources.map((source) => optionLabel(source.name)), 2, stepExtraRows(ctx, action, draft)));
}

async function promptSetup(ctx: Ctx, draft: Draft): Promise<void> {
  const setups = await loadFlipSetups(ctx.userId);
  if (!setups.length) {
    await endFlow(ctx, "Немає збережених сетапів. Додай перший фліп на сайті.");
    return;
  }
  draft.options = setups;
  await saveFlow(ctx.telegramUserId, { action: "flip", step: "setup", draft });
  await reply(ctx, "<b>Сетап</b>", optionKeyboard(setups.map((setup) => optionLabel(setup)), 1));
}

async function promptDate(ctx: Ctx, action: FlowAction, draft: Draft, from: FlowStep): Promise<void> {
  draft.returnStep = from;
  delete draft.options;
  await saveFlow(ctx.telegramUserId, { action, step: "date", draft });
  await reply(
    ctx,
    ["<b>Дата операції</b>", "Впиши цифрами: <code>30.08.2026</code>", "або <code>30.08</code> — цьогоріч"].join("\n"),
    { inline_keyboard: [[{ text: "Сьогодні", callback_data: CALLBACK.today }], [cancelButton()]] }
  );
}

/** Re-renders whichever step the user left to set a date. */
async function renderStep(ctx: Ctx, action: FlowAction, step: FlowStep, draft: Draft): Promise<void> {
  if (step === "category") return promptCategory(ctx, action, draft);
  if (step === "source") return promptSource(ctx, action, draft);
  if (step === "setup") return promptSetup(ctx, draft);
  if (step === "note") return promptNote(ctx, action, draft);
  if (step === "account") return promptAccount(ctx, action, draft);
  if (step === "amount") return promptAmount(ctx, action, draft);
  if (step === "input") return promptFirstStep(ctx, action, draft);
  return advance(ctx, action, draft);
}

async function promptNote(ctx: Ctx, action: FlowAction, draft: Draft): Promise<void> {
  delete draft.options;
  await saveFlow(ctx.telegramUserId, { action, step: "note", draft });
  await reply(ctx, "Примітка? Надішли текст або натисни кнопку.", {
    inline_keyboard: [
      [{ text: "Без примітки", callback_data: CALLBACK.skipNote }],
      ...stepExtraRows(ctx, action, draft),
      [cancelButton()]
    ]
  });
}

async function promptNewBalance(ctx: Ctx, draft: Draft): Promise<void> {
  const account = findAccountById(ctx.data.accounts, draft.accountId);
  if (!account) {
    await endFlow(ctx, "Рахунок не знайдено.");
    return;
  }
  delete draft.options;
  await saveFlow(ctx.telegramUserId, { action: "manual", step: "balance", draft });
  await reply(
    ctx,
    `Новий баланс для <b>${escapeHtml(account.name)}</b>?\nЗараз: ${escapeHtml(formatAmount(account.currentBalance.toString(), account.currency))}`,
    cancelKeyboard()
  );
}

/** Walks the draft forward: prompts for the first thing that is still missing, otherwise saves. */
async function advance(ctx: Ctx, action: FlowAction, draft: Draft): Promise<void> {
  if (action === "manual") {
    if (!draft.accountId) return promptAccount(ctx, action, draft);
    return promptNewBalance(ctx, draft);
  }
  if (!draft.amount) return promptAmount(ctx, action, draft);

  if (action === "flip") {
    if (!draft.setup) return promptSetup(ctx, draft);
    return complete(ctx, action, draft);
  }

  if (action === "savings") {
    draft.currency = "UAH";
    if (!draft.accountId) {
      const candidates = savingsSourceAccounts(ctx.data.accounts);
      const preferred = candidates.find((account) => account.id === ctx.data.settings?.expenseDefaultSourceId);
      if (preferred) draft.accountId = preferred.id;
      else return promptAccount(ctx, action, draft);
    }
    if (draft.note === undefined) return promptNote(ctx, action, draft);
    return complete(ctx, action, draft);
  }

  const currency: TelegramCurrency = draft.currency || "UAH";
  if (!draft.accountId) {
    const auto = action === "income" ? pickIncomeAccount(ctx.data, ctx.session, currency) : pickExpenseAccount(ctx.data, ctx.session, currency);
    if (auto) draft.accountId = auto.id;
    else return promptAccount(ctx, action, draft);
  }
  if (action === "expense" && !draft.categoryId) return promptCategory(ctx, action, draft);
  if ((action === "income" || action === "work") && !draft.incomeSourceId) return promptSource(ctx, action, draft);
  if (draft.note === undefined) return promptNote(ctx, action, draft);
  return complete(ctx, action, draft);
}

async function finish(ctx: Ctx, result: OperationResult): Promise<void> {
  await reply(ctx, result.text, result.undo ? undoKeyboard(result.undo) : undefined);
  await clearFlow(ctx.telegramUserId);
  ctx.messageId = null;
}

async function complete(ctx: Ctx, action: FlowAction, draft: Draft): Promise<void> {
  const amount = draft.amount || "0";
  const currency: TelegramCurrency = draft.currency || "UAH";
  const note = draft.note ?? null;
  const date = resolveTransactionDate(draft.date);

  const accountId = draft.accountId;
  const categoryId = draft.categoryId ?? null;
  const incomeSourceId = draft.incomeSourceId ?? null;

  if (action === "flip") {
    await finish(ctx, await submitFlip(ctx.userId, { pnl: draft.amount || "0", setup: draft.setup || "", date }));
    return;
  }
  if (action === "savings") {
    if (!accountId) return promptAccount(ctx, action, draft);
    const result = await submitSavings(ctx.userId, { amount, accountId, note, date }, ctx.data);
    await finish(ctx, result);
    return;
  }
  if (action === "manual") {
    if (!accountId) return promptAccount(ctx, action, draft);
    const result = await submitManualAdjustment(ctx.userId, { accountId, newBalance: amount }, ctx.data);
    await finish(ctx, result);
    return;
  }
  if (action === "expense" || action === "work") {
    if (!accountId) return promptAccount(ctx, action, draft);
    const result = await submitExpense(
      ctx.userId,
      {
        amount,
        currency,
        accountId,
        categoryId: action === "expense" ? categoryId : null,
        incomeSourceId: action === "work" ? incomeSourceId : null,
        note,
        date,
        isWorkExpense: action === "work"
      },
      ctx.data
    );
    await finish(ctx, result);
    const patch: RememberedSelections = { lastExpenseAccountId: accountId };
    if (action === "expense" && categoryId) patch.lastCategoryId = categoryId;
    if (action === "work" && incomeSourceId) patch.lastIncomeSourceId = incomeSourceId;
    await rememberSelections(ctx.telegramUserId, patch);
    return;
  }
  if (action === "income") {
    if (!accountId || !incomeSourceId) return advance(ctx, action, draft);
    const result = await submitIncome(ctx.userId, { amount, currency, accountId, incomeSourceId, note, date }, ctx.data);
    await finish(ctx, result);
    await rememberSelections(ctx.telegramUserId, {
      lastIncomeSourceId: incomeSourceId,
      ...incomeAccountPatch(currency, accountId)
    });
    return;
  }
  await endFlow(ctx, GENERIC_ERROR);
}

async function handleFlowMessage(ctx: Ctx, action: FlowAction, step: FlowStep, text: string): Promise<void> {
  const draft = readDraft(ctx.session);

  if (step === "input") {
    await handleSingleInput(ctx, action, text, draft);
    return;
  }
  if (step === "amount" && action === "flip") {
    const full = parseFlipEntry(text);
    if (full) {
      draft.amount = full.pnl;
      draft.setup = full.setup;
      await advance(ctx, action, draft);
      return;
    }
    const entry = parseQuickEntry(text);
    if (!entry || D(entry.amount).lte(0)) {
      await reply(ctx, "Не зрозумів PnL. Напр. <code>35.5</code> або <code>-12</code>.", cancelKeyboard());
      return;
    }
    draft.amount = entry.hasExplicitSign && entry.kind === "expense" ? `-${entry.amount}` : entry.amount;
    await advance(ctx, action, draft);
    return;
  }
  if (step === "amount") {
    const names = action === "income" || action === "work"
      ? ctx.data.incomeSources.map((source) => source.name)
      : ctx.data.categories.map((category) => category.name);
    const parsed = parseQuickEntry(text, names);
    if (!parsed || D(parsed.amount).lte(0)) {
      await reply(ctx, "Не зрозумів суму. Напр.: <code>250</code>, <code>1 250,50</code> або <code>20 USDT</code>.", cancelKeyboard());
      return;
    }
    draft.amount = parsed.amount;
    draft.currency = action === "savings" ? "UAH" : parsed.currency || "UAH";
    if (parsed.note) draft.note = truncate(parsed.note, 200);
    if (parsed.tagProvided && parsed.tag) {
      if (action === "income" || action === "work") {
        const source = findIncomeSource(ctx.data.incomeSources, parsed.tag);
        if (source) draft.incomeSourceId = source.id;
      } else {
        const category = findCategory(ctx.data.categories, parsed.tag);
        if (category) draft.categoryId = category.id;
      }
    }
    await advance(ctx, action, draft);
    return;
  }
  if (step === "date") {
    const parsed = parseTypedDate(text);
    if (!parsed) {
      await reply(ctx, "Не зрозумів дату. Напр. <code>30.08.2026</code> або <code>30.08</code>.", cancelKeyboard());
      return;
    }
    draft.date = parsed;
    const back = draft.returnStep || "note";
    delete draft.returnStep;
    await renderStep(ctx, action, back, draft);
    return;
  }
  if (step === "note") {
    draft.note = truncate(text, 200);
    await advance(ctx, action, draft);
    return;
  }
  if (step === "balance") {
    const parsed = parseQuickEntry(text);
    if (!parsed) {
      await reply(ctx, "Надішли новий баланс числом, напр. <code>12 500</code>.", cancelKeyboard());
      return;
    }
    draft.amount = parsed.amount;
    await complete(ctx, "manual", draft);
    return;
  }
  if (step === "category") {
    const category = findCategory(ctx.data.categories, text);
    if (!category) {
      await reply(ctx, "Такої категорії немає. Обери кнопкою вище або /cancel.");
      return;
    }
    draft.categoryId = category.id;
    await advance(ctx, action, draft);
    return;
  }
  if (step === "source") {
    const source = findIncomeSource(ctx.data.incomeSources, text);
    if (!source) {
      await reply(ctx, "Такого джерела немає. Обери кнопкою вище або /cancel.");
      return;
    }
    draft.incomeSourceId = source.id;
    await advance(ctx, action, draft);
    return;
  }
  await reply(ctx, "Обери варіант кнопкою вище або /cancel.");
}

async function handleSingleInput(ctx: Ctx, action: FlowAction, text: string, draft: Draft): Promise<void> {
  const date = resolveTransactionDate(draft.date);
  if (action === "p2p") {
    const parsed = parseP2PEntry(text);
    if (!parsed || D(parsed.receivedUah).lte(0) || D(parsed.rateUahPerUsdt).lte(0)) {
      await reply(ctx, "Формат: <code>5000 41.25 Binance</code>", cancelKeyboard());
      return;
    }
    await finish(ctx, await submitP2P(ctx.userId, { ...parsed, date }, ctx.data));
    return;
  }
  if (action === "cash") {
    const parsed = parseCashEntry(text);
    if (!parsed || D(parsed.receivedAmount).lte(0) || D(parsed.rate).lte(0)) {
      await reply(ctx, "Формат: <code>10000 UAH 41.2 Cashalot</code>", cancelKeyboard());
      return;
    }
    await finish(ctx, await submitCash(ctx.userId, { ...parsed, date }, ctx.data));
    return;
  }
  if (action === "expected") {
    const parsed = parseExpectedEntry(text);
    if (!parsed || D(parsed.amount).lte(0)) {
      await reply(ctx, "Формат: <code>250 USDT холд біржі</code>", cancelKeyboard());
      return;
    }
    await finish(ctx, await submitExpectedMoney(ctx.userId, parsed));
    return;
  }
  await reply(ctx, GENERIC_ERROR, menuKeyboard());
}

/** The one-line path: `- 250 #Їжа кава`, `+ 300 USDT #Боти виплата`. */
async function handleQuickEntry(ctx: Ctx, text: string): Promise<void> {
  const probe = parseQuickEntry(text);
  if (!probe || D(probe.amount).lte(0)) {
    await sendNew(ctx, hintText());
    return;
  }
  const isIncome = probe.kind === "income";
  const names = isIncome ? ctx.data.incomeSources.map((item) => item.name) : ctx.data.categories.map((item) => item.name);
  const entry = parseQuickEntry(text, names) || probe;
  const currency: TelegramCurrency = entry.currency || "UAH";
  const note = entry.note ? truncate(entry.note, 200) : null;

  const account = isIncome
    ? pickIncomeAccount(ctx.data, ctx.session, currency)
    : pickExpenseAccount(ctx.data, ctx.session, currency);
  if (!account) {
    await reply(ctx, `Немає активного рахунку ${escapeHtml(currency)}. Створи його на сайті Feelky.`, menuKeyboard());
    return;
  }

  if (isIncome) {
    const source = entry.tagProvided
      ? findIncomeSource(ctx.data.incomeSources, entry.tag)
      : fallbackReference(ctx.data.incomeSources, ctx.session.lastIncomeSourceId);
    if (!source) {
      const draft: Draft = { amount: entry.amount, currency, accountId: account.id, note };
      await saveFlow(ctx.telegramUserId, { action: "income", step: "source", draft });
      ctx.session = await refreshSession(ctx);
      await promptSource(ctx, "income", draft, `Джерело «${escapeHtml(entry.tag || "")}» не знайдено.`);
      return;
    }
    const result = await submitIncome(
      ctx.userId,
      { amount: entry.amount, currency, accountId: account.id, incomeSourceId: source.id, note },
      ctx.data
    );
    await finish(ctx, result);
    await rememberSelections(ctx.telegramUserId, {
      lastIncomeSourceId: source.id,
      ...incomeAccountPatch(currency, account.id)
    });
    return;
  }

  const category = entry.tagProvided
    ? findCategory(ctx.data.categories, entry.tag)
    : fallbackReference(ctx.data.categories, ctx.session.lastCategoryId);
  if (!category) {
    const draft: Draft = { amount: entry.amount, currency, accountId: account.id, note };
    await saveFlow(ctx.telegramUserId, { action: "expense", step: "category", draft });
    ctx.session = await refreshSession(ctx);
    await promptCategory(ctx, "expense", draft, `Категорію «${escapeHtml(entry.tag || "")}» не знайдено.`);
    return;
  }
  const result = await submitExpense(
    ctx.userId,
    { amount: entry.amount, currency, accountId: account.id, categoryId: category.id, note },
    ctx.data
  );
  await finish(ctx, result);
  await rememberSelections(ctx.telegramUserId, { lastCategoryId: category.id, lastExpenseAccountId: account.id });
}

function hintText(): string {
  return [
    "Не зрозумів. Швидкий формат:",
    `<code>${escapeHtml("- 250 кава")}</code>`,
    `<code>${escapeHtml("- 1 250,50 грн продукти")}</code>`,
    `<code>${escapeHtml("- 20 USDT #Steam ключі")}</code>`,
    `<code>${escapeHtml("+ 1500 UAH #Робота аванс")}</code>`,
    "",
    "Або обери дію нижче."
  ].join("\n");
}

function helpText(): string {
  const commands = BOT_COMMANDS.map((item) => `/${item.command} — ${escapeHtml(item.description)}`).join("\n");
  return [
    "<b>Швидкі записи</b>",
    `<code>${escapeHtml("- 250 кава")}</code> — витрата 250 UAH`,
    `<code>${escapeHtml("- 1 250,50 грн продукти")}</code>`,
    `<code>${escapeHtml("- 20 USDT #Steam ключі")}</code>`,
    `<code>${escapeHtml("+ 1500 UAH #Робота аванс")}</code>`,
    `<code>${escapeHtml("+ 300 USDT #Боти виплата")}</code>`,
    "",
    "Без валюти — UAH. Без <code>#</code> — остання категорія/джерело.",
    "Кома і крапка працюють однаково, пробіли в сумі теж.",
    "",
    "<b>Однорядкові формати</b>",
    `P2P: <code>5000 41.25 Binance</code>`,
    `Готівка: <code>10000 UAH 41.2 Cashalot</code>`,
    `Очікувані: <code>250 USDT холд біржі</code>`,
    `Фліп: <code>${escapeHtml("+35.5 Buff → TM")}</code>`,
    "",
    "<b>Команди</b>",
    commands
  ].join("\n");
}
