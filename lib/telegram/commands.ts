import type { BotCommand } from "@/lib/telegram/types";

/** Registered with setMyCommands, so they show up in the Telegram command menu. */
export const BOT_COMMANDS: BotCommand[] = [
  { command: "menu", description: "Головне меню" },
  { command: "expense", description: "Витрата" },
  { command: "income", description: "Дохід" },
  { command: "work", description: "Робоча витрата" },
  { command: "p2p", description: "P2P-вивід" },
  { command: "cash", description: "Вивід у готівку" },
  { command: "savings", description: "Відкладення" },
  { command: "expected", description: "Очікувані/заморожені гроші" },
  { command: "flip", description: "Фліп" },
  { command: "balance", description: "Поточні баланси" },
  { command: "accounts", description: "Список рахунків" },
  { command: "cancel", description: "Скасувати поточну дію" },
  { command: "help", description: "Довідка" }
];

export const ALLOWED_UPDATES = ["message", "callback_query"];

/** `/expense@feelky_bot arg` -> { command: "expense", args: "arg" } */
export function parseCommand(text: string): { command: string; args: string } | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("/")) return null;
  const match = /^\/([A-Za-z0-9_]{1,32})(?:@[A-Za-z0-9_]+)?\s*([\s\S]*)$/.exec(trimmed);
  if (!match) return null;
  return { command: match[1].toLowerCase(), args: match[2].trim() };
}
