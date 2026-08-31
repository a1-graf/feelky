import { describe, expect, it } from "vitest";
import { dateLabel, isValidDateKey, kyivToday, parseTypedDate, recentDates, resolveTransactionDate } from "@/lib/telegram/dates";

const NOON = new Date("2026-08-31T09:00:00.000Z");

describe("kyiv calendar day", () => {
  it("uses the Kyiv date, not UTC", () => {
    expect(kyivToday(NOON)).toBe("2026-08-31");
    // 22:30 UTC is already the next day in Kyiv
    expect(kyivToday(new Date("2026-08-31T22:30:00.000Z"))).toBe("2026-09-01");
  });

  it("lists recent days newest first", () => {
    expect(recentDates(3, NOON)).toEqual(["2026-08-31", "2026-08-30", "2026-08-29"]);
  });
});

describe("date labels", () => {
  it("names today and yesterday", () => {
    expect(dateLabel("2026-08-31", NOON)).toBe("Сьогодні");
    expect(dateLabel("2026-08-30", NOON)).toBe("Вчора");
    expect(dateLabel("2026-08-12", NOON)).toBe("12.08");
  });
});

describe("typed dates", () => {
  it("accepts the usual Ukrainian formats", () => {
    expect(parseTypedDate("30.08.2026", NOON)).toBe("2026-08-30");
    expect(parseTypedDate("5.7.2026", NOON)).toBe("2026-07-05");
    expect(parseTypedDate("30/08/26", NOON)).toBe("2026-08-30");
    expect(parseTypedDate("2026-08-30", NOON)).toBe("2026-08-30");
  });

  it("fills in the current year when it is omitted", () => {
    expect(parseTypedDate("30.08", NOON)).toBe("2026-08-30");
  });

  it("rejects nonsense", () => {
    expect(parseTypedDate("32.08.2026", NOON)).toBeNull();
    expect(parseTypedDate("30.13.2026", NOON)).toBeNull();
    expect(parseTypedDate("вчора", NOON)).toBeNull();
    expect(parseTypedDate("", NOON)).toBeNull();
  });

  it("validates keys", () => {
    expect(isValidDateKey("2026-02-29")).toBe(false);
    expect(isValidDateKey("2024-02-29")).toBe(true);
  });
});

describe("resolving the stored date", () => {
  it("keeps the real timestamp for today", () => {
    expect(resolveTransactionDate("2026-08-31", NOON).toISOString()).toBe(NOON.toISOString());
    expect(resolveTransactionDate(undefined, NOON).toISOString()).toBe(NOON.toISOString());
  });

  it("anchors a past day to midday UTC so the calendar day never shifts", () => {
    const past = resolveTransactionDate("2026-08-12", NOON);
    expect(past.toISOString()).toBe("2026-08-12T12:00:00.000Z");
    const inKyiv = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Kyiv" }).format(past);
    expect(inKyiv).toBe("2026-08-12");
  });

  it("ignores a malformed value", () => {
    expect(resolveTransactionDate("31-08-2026", NOON).toISOString()).toBe(NOON.toISOString());
  });
});
