import { isCallbackDataWithinLimit } from "@/lib/telegram/security";
import type { UndoRef } from "@/lib/telegram/undo";
import { encodeUndoRef } from "@/lib/telegram/undo";
import type { InlineKeyboardButton, InlineKeyboardMarkup } from "@/lib/telegram/types";

export const CALLBACK = {
  menu: "m",
  option: "o",
  skipNote: "n:skip",
  changeAccount: "o:acc",
  changeDate: "o:date",
  today: "o:today",
  back: "m:menu",
  cancel: "m:cancel",
  noop: "noop"
} as const;

export const MENU_ITEMS: Array<{ text: string; data: string }> = [
  { text: "Витрата", data: "m:expense" },
  { text: "Дохід", data: "m:income" },
  { text: "Робоча витрата", data: "m:work" },
  { text: "Відкладення", data: "m:savings" },
  { text: "P2P-вивід", data: "m:p2p" },
  { text: "Готівка", data: "m:cash" },
  { text: "Очікувані", data: "m:expected" },
  { text: "Фліп", data: "m:flip" },
  { text: "Баланс рахунку", data: "m:manual" },
  { text: "Баланси", data: "m:balance" },
  { text: "Скасувати дію", data: "m:cancel" }
];

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size));
  }
  return rows;
}

export function menuKeyboard(): InlineKeyboardMarkup {
  const buttons = MENU_ITEMS.map((item) => ({ text: item.text, callback_data: item.data }));
  return { inline_keyboard: chunk(buttons, 2) };
}

/**
 * Option pickers never put database ids into callback_data: the rendered order is stored in the
 * session draft and the button only carries its index, which always fits Telegram's 64-byte limit.
 */
export function optionKeyboard(labels: string[], columns = 2, extraRows: InlineKeyboardButton[][] = []): InlineKeyboardMarkup {
  const buttons = labels.map((label, index) => ({
    text: label,
    callback_data: `${CALLBACK.option}:${index}`
  }));
  return { inline_keyboard: [...chunk(buttons, columns), ...extraRows, [cancelButton()]] };
}

export function cancelButton(): InlineKeyboardButton {
  return { text: "Скасувати", callback_data: CALLBACK.cancel };
}

export function changeAccountButton(accountName: string): InlineKeyboardButton {
  return { text: `Рахунок: ${accountName}`, callback_data: CALLBACK.changeAccount };
}

export function changeDateButton(label: string): InlineKeyboardButton {
  return { text: `Дата: ${label}`, callback_data: CALLBACK.changeDate };
}

export function cancelKeyboard(): InlineKeyboardMarkup {
  return { inline_keyboard: [[cancelButton()]] };
}

export function noteKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: "Без примітки", callback_data: CALLBACK.skipNote }],
      [cancelButton()]
    ]
  };
}

export function undoKeyboard(ref: UndoRef): InlineKeyboardMarkup | undefined {
  const data = encodeUndoRef(ref);
  if (!isCallbackDataWithinLimit(data)) return undefined;
  return {
    inline_keyboard: [[
      { text: "Скасувати операцію", callback_data: data },
      { text: "Меню", callback_data: CALLBACK.back }
    ]]
  };
}

export function optionLabel(name: string, detail?: string | null): string {
  const label = detail ? `${name} · ${detail}` : name;
  return label.length > 34 ? `${label.slice(0, 33)}…` : label;
}

export function menuText(): string {
  return "<b>Feelky</b>\nОбери дію:";
}
