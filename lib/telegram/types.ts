/** Minimal shape of the Telegram Bot API objects Feelky actually reads. */

export type TelegramChat = {
  id: number;
  type: string;
};

export type TelegramFrom = {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  username?: string;
};

export type TelegramIncomingMessage = {
  message_id: number;
  date?: number;
  from?: TelegramFrom;
  chat: TelegramChat;
  text?: string;
};

export type TelegramCallbackQuery = {
  id: string;
  from?: TelegramFrom;
  message?: TelegramIncomingMessage;
  data?: string;
};

export type TelegramUpdatePayload = {
  update_id: number;
  message?: TelegramIncomingMessage;
  edited_message?: TelegramIncomingMessage;
  callback_query?: TelegramCallbackQuery;
};

export type InlineKeyboardButton = {
  text: string;
  callback_data: string;
};

export type InlineKeyboardMarkup = {
  inline_keyboard: InlineKeyboardButton[][];
};

export type ReplyKeyboardButton = {
  text: string;
};

/** The always-visible keyboard under the input field. */
export type ReplyKeyboardMarkup = {
  keyboard: ReplyKeyboardButton[][];
  resize_keyboard?: boolean;
  is_persistent?: boolean;
  input_field_placeholder?: string;
};

export type ReplyMarkup = InlineKeyboardMarkup | ReplyKeyboardMarkup;

export type BotCommand = {
  command: string;
  description: string;
};

export function isTelegramUpdatePayload(value: unknown): value is TelegramUpdatePayload {
  if (!value || typeof value !== "object") return false;
  const updateId = (value as { update_id?: unknown }).update_id;
  return typeof updateId === "number" && Number.isFinite(updateId);
}
