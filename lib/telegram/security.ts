import { timingSafeEqual } from "node:crypto";

/** Telegram numeric ids fit into a double, but we still refuse anything that is not a clean integer. */
export function parseAllowedUserIds(raw: string | undefined | null): number[] {
  if (!raw) return [];
  return Array.from(
    new Set(
      raw
        .split(/[\s,;]+/)
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => Number(item))
        .filter((item) => Number.isSafeInteger(item) && item > 0)
    )
  );
}

/** Fails closed: an empty allow list gives nobody access. */
export function isAllowedTelegramUser(telegramUserId: number | undefined | null, allowed: number[]): boolean {
  if (!allowed.length) return false;
  if (typeof telegramUserId !== "number" || !Number.isSafeInteger(telegramUserId)) return false;
  return allowed.includes(telegramUserId);
}

export function isPrivateChat(chatType: string | undefined | null): boolean {
  return chatType === "private";
}

/** Constant-time comparison of the X-Telegram-Bot-Api-Secret-Token header. */
export function isValidSecretToken(received: string | undefined | null, expected: string | undefined | null): boolean {
  if (!expected) return false;
  if (typeof received !== "string" || !received) return false;
  const a = Buffer.from(received, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Telegram rejects callback_data longer than 64 bytes. */
export const MAX_CALLBACK_DATA_BYTES = 64;

export function isCallbackDataWithinLimit(data: string): boolean {
  return Buffer.byteLength(data, "utf8") <= MAX_CALLBACK_DATA_BYTES;
}
