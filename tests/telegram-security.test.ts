import { describe, expect, it } from "vitest";
import {
  isAllowedTelegramUser,
  isCallbackDataWithinLimit,
  isPrivateChat,
  isValidSecretToken,
  MAX_CALLBACK_DATA_BYTES,
  parseAllowedUserIds
} from "@/lib/telegram/security";
import { encodeUndoRef } from "@/lib/telegram/undo";
import { MENU_ITEMS } from "@/lib/telegram/keyboards";

describe("allowed telegram users", () => {
  it("parses comma, semicolon and space separated ids", () => {
    expect(parseAllowedUserIds("111, 222; 333 444")).toEqual([111, 222, 333, 444]);
  });

  it("drops junk and duplicates", () => {
    expect(parseAllowedUserIds("111,abc,,111,-5,0")).toEqual([111]);
  });

  it("returns an empty list for empty env", () => {
    expect(parseAllowedUserIds(undefined)).toEqual([]);
    expect(parseAllowedUserIds("")).toEqual([]);
  });

  it("accepts an allowed id", () => {
    expect(isAllowedTelegramUser(222, [111, 222])).toBe(true);
  });

  it("rejects a foreign telegram user id", () => {
    expect(isAllowedTelegramUser(999, [111, 222])).toBe(false);
    expect(isAllowedTelegramUser(undefined, [111, 222])).toBe(false);
  });

  it("fails closed when nobody is allowed", () => {
    expect(isAllowedTelegramUser(111, [])).toBe(false);
  });
});

describe("chat type", () => {
  it("only allows private chats", () => {
    expect(isPrivateChat("private")).toBe(true);
    expect(isPrivateChat("group")).toBe(false);
    expect(isPrivateChat("supergroup")).toBe(false);
    expect(isPrivateChat(undefined)).toBe(false);
  });
});

describe("webhook secret token", () => {
  it("accepts the exact secret", () => {
    expect(isValidSecretToken("s3cret-value", "s3cret-value")).toBe(true);
  });

  it("rejects a wrong or missing secret", () => {
    expect(isValidSecretToken("s3cret-valuX", "s3cret-value")).toBe(false);
    expect(isValidSecretToken("short", "s3cret-value")).toBe(false);
    expect(isValidSecretToken(null, "s3cret-value")).toBe(false);
    expect(isValidSecretToken("", "s3cret-value")).toBe(false);
  });

  it("rejects everything when no secret is configured", () => {
    expect(isValidSecretToken("anything", "")).toBe(false);
  });
});

describe("callback data size", () => {
  it("keeps undo payloads inside the Telegram limit", () => {
    const data = encodeUndoRef({ kind: "expected", id: "c".repeat(25) });
    expect(isCallbackDataWithinLimit(data)).toBe(true);
    expect(Buffer.byteLength(data, "utf8")).toBeLessThanOrEqual(MAX_CALLBACK_DATA_BYTES);
  });

  it("keeps every menu button inside the limit", () => {
    for (const item of MENU_ITEMS) {
      expect(isCallbackDataWithinLimit(item.data)).toBe(true);
    }
  });

  it("rejects oversized payloads", () => {
    expect(isCallbackDataWithinLimit("x".repeat(MAX_CALLBACK_DATA_BYTES + 1))).toBe(false);
  });
});
