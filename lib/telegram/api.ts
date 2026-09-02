import type { BotCommand, InlineKeyboardMarkup, ReplyMarkup } from "@/lib/telegram/types";

const TELEGRAM_API_ORIGIN = "https://api.telegram.org";

export class TelegramApiError extends Error {
  constructor(public readonly method: string, public readonly description: string, public readonly errorCode?: number) {
    super(`Telegram ${method} failed: ${description}`);
    this.name = "TelegramApiError";
  }
}

type TelegramApiResponse<T> = {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
};

/**
 * Thin fetch wrapper around the Bot API. The token lives in the URL, so neither the URL
 * nor the raw response is ever logged or attached to a thrown error.
 */
export async function callTelegram<T>(method: string, payload: Record<string, unknown>, botToken: string): Promise<T> {
  if (!botToken) throw new TelegramApiError(method, "bot token is not configured");
  const response = await fetch(`${TELEGRAM_API_ORIGIN}/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store"
  });
  let data: TelegramApiResponse<T>;
  try {
    data = (await response.json()) as TelegramApiResponse<T>;
  } catch {
    throw new TelegramApiError(method, `unexpected response (HTTP ${response.status})`, response.status);
  }
  if (!data.ok) {
    throw new TelegramApiError(method, data.description || `HTTP ${response.status}`, data.error_code ?? response.status);
  }
  return data.result as T;
}

export type SendMessageOptions = {
  replyMarkup?: ReplyMarkup;
  disablePreview?: boolean;
};

export async function sendMessage(botToken: string, chatId: number | bigint, text: string, options: SendMessageOptions = {}) {
  return callTelegram<{ message_id: number }>(
    "sendMessage",
    {
      chat_id: typeof chatId === "bigint" ? chatId.toString() : chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: options.disablePreview ?? true,
      ...(options.replyMarkup ? { reply_markup: options.replyMarkup } : {})
    },
    botToken
  );
}

export async function editMessageText(
  botToken: string,
  chatId: number | bigint,
  messageId: number,
  text: string,
  replyMarkup?: InlineKeyboardMarkup
) {
  return callTelegram<unknown>(
    "editMessageText",
    {
      chat_id: typeof chatId === "bigint" ? chatId.toString() : chatId,
      message_id: messageId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: replyMarkup ?? { inline_keyboard: [] }
    },
    botToken
  );
}

export async function editMessageReplyMarkup(
  botToken: string,
  chatId: number | bigint,
  messageId: number,
  replyMarkup?: InlineKeyboardMarkup
) {
  return callTelegram<unknown>(
    "editMessageReplyMarkup",
    {
      chat_id: typeof chatId === "bigint" ? chatId.toString() : chatId,
      message_id: messageId,
      reply_markup: replyMarkup ?? { inline_keyboard: [] }
    },
    botToken
  );
}

/**
 * Removes a message the bot can delete. In a private chat Telegram lets a bot delete both
 * its own and incoming messages, which is what keeps a scenario pinned to the bottom.
 */
export async function deleteMessage(botToken: string, chatId: number | bigint, messageId: number) {
  return callTelegram<boolean>(
    "deleteMessage",
    { chat_id: typeof chatId === "bigint" ? chatId.toString() : chatId, message_id: messageId },
    botToken
  );
}

export async function answerCallbackQuery(botToken: string, callbackQueryId: string, text?: string, showAlert = false) {
  return callTelegram<boolean>(
    "answerCallbackQuery",
    {
      callback_query_id: callbackQueryId,
      ...(text ? { text: text.slice(0, 200) } : {}),
      show_alert: showAlert
    },
    botToken
  );
}

export async function setMyCommands(botToken: string, commands: BotCommand[]) {
  return callTelegram<boolean>("setMyCommands", { commands }, botToken);
}

export async function setWebhook(botToken: string, url: string, secretToken: string, allowedUpdates: string[]) {
  return callTelegram<boolean>(
    "setWebhook",
    {
      url,
      secret_token: secretToken,
      allowed_updates: allowedUpdates,
      drop_pending_updates: false,
      max_connections: 20
    },
    botToken
  );
}

export async function getWebhookInfo(botToken: string) {
  return callTelegram<{ url?: string; pending_update_count?: number; last_error_message?: string }>(
    "getWebhookInfo",
    {},
    botToken
  );
}
