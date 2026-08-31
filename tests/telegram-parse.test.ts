import { describe, expect, it } from "vitest";
import {
  parseCashEntry,
  parseExpectedEntry,
  parseFlipEntry,
  parseP2PEntry,
  parseQuickEntry,
  resolveReferenceName,
  splitTagAndNote
} from "@/lib/telegram/parse";

const CATEGORIES = ["Їжа", "Ресторани", "Здоров'я", "Техніка", "Розваги", "Підписки", "Перекази людям", "Steam", "Інше"];
const INCOME_SOURCES = ["Робота", "Трейдинг", "Боти", "Steam", "Повернення боргу", "Інше"];

describe("quick expense entry", () => {
  it("parses a bare expense with a note", () => {
    const entry = parseQuickEntry("- 250 кава", CATEGORIES);
    expect(entry).toMatchObject({ kind: "expense", amount: "250", currency: null, note: "кава", tagProvided: false });
  });

  it("treats a message without a sign as an expense", () => {
    expect(parseQuickEntry("250 кава", CATEGORIES)).toMatchObject({ kind: "expense", amount: "250", hasExplicitSign: false });
  });

  it("keeps the category hashtag out of the note", () => {
    const entry = parseQuickEntry("- 250 #Їжа кава", CATEGORIES);
    expect(entry).toMatchObject({ kind: "expense", amount: "250", tag: "Їжа", tagProvided: true, note: "кава" });
  });

  it("rejects text without an amount", () => {
    expect(parseQuickEntry("привіт", CATEGORIES)).toBeNull();
    expect(parseQuickEntry("", CATEGORIES)).toBeNull();
  });
});

describe("quick income entry", () => {
  it("parses income with an income source hashtag", () => {
    const entry = parseQuickEntry("+ 1500 UAH #Робота аванс", INCOME_SOURCES);
    expect(entry).toMatchObject({ kind: "income", amount: "1500", currency: "UAH", tag: "Робота", note: "аванс" });
  });

  it("parses USDT income", () => {
    const entry = parseQuickEntry("+ 300 USDT #Боти виплата", INCOME_SOURCES);
    expect(entry).toMatchObject({ kind: "income", amount: "300", currency: "USDT", tag: "Боти", note: "виплата" });
  });
});

describe("currencies", () => {
  it("supports UAH aliases", () => {
    expect(parseQuickEntry("- 1250,50 грн продукти")?.currency).toBe("UAH");
    expect(parseQuickEntry("- 300 UAH таксі")?.currency).toBe("UAH");
    expect(parseQuickEntry("- 300 ₴ таксі")?.currency).toBe("UAH");
    expect(parseQuickEntry("- 300₴ таксі")?.currency).toBe("UAH");
  });

  it("supports USDT and USD", () => {
    expect(parseQuickEntry("- 20 USDT ключі")?.currency).toBe("USDT");
    expect(parseQuickEntry("- 15 USD обід")?.currency).toBe("USD");
    expect(parseQuickEntry("- 15$ обід")?.currency).toBe("USD");
  });

  it("leaves the currency unset when no token is given", () => {
    expect(parseQuickEntry("- 250 кава")?.currency).toBeNull();
  });

  it("does not treat a plain word as a currency", () => {
    const entry = parseQuickEntry("- 250 кава");
    expect(entry?.currency).toBeNull();
    expect(entry?.note).toBe("кава");
  });
});

describe("decimal separators and spacing", () => {
  it("accepts a comma", () => {
    expect(parseQuickEntry("- 1250,50 грн продукти")?.amount).toBe("1250.50");
  });

  it("accepts a dot", () => {
    expect(parseQuickEntry("- 1250.50 грн продукти")?.amount).toBe("1250.50");
  });

  it("accepts spaces inside the amount", () => {
    expect(parseQuickEntry("- 1 250,50 грн продукти")?.amount).toBe("1250.50");
    expect(parseQuickEntry("- 1 250 500 інше")?.amount).toBe("1250500");
  });

  it("accepts a non-breaking space inside the amount", () => {
    expect(parseQuickEntry("- 1\u00A0250,50 грн продукти")?.amount).toBe("1250.50");
    expect(parseQuickEntry("- 1\u202F250,50 грн продукти")?.amount).toBe("1250.50");
  });
});

describe("hashtag resolution", () => {
  it("matches multi-word reference names", () => {
    const entry = parseQuickEntry("+ 900 #Повернення боргу від Влада", INCOME_SOURCES);
    expect(entry).toMatchObject({ tag: "Повернення боргу", note: "від Влада" });
  });

  it("prefers the longest matching name", () => {
    expect(resolveReferenceName("Повернення боргу решта", INCOME_SOURCES)).toEqual({ name: "Повернення боргу", rest: "решта" });
  });

  it("is case insensitive", () => {
    expect(parseQuickEntry("- 100 #їжа снек", CATEGORIES)?.tag).toBe("Їжа");
  });

  it("falls back to the first word for unknown tags", () => {
    const entry = parseQuickEntry("- 100 #Невідома щось", CATEGORIES);
    expect(entry).toMatchObject({ tag: "Невідома", tagProvided: true, note: "щось" });
  });

  it("keeps text typed before the hashtag in the note", () => {
    expect(splitTagAndNote("вечеря #Ресторани з друзями", CATEGORIES)).toEqual({
      tag: "Ресторани",
      tagProvided: true,
      note: "вечеря з друзями"
    });
  });
});

describe("p2p format", () => {
  it("parses received UAH, rate and note", () => {
    expect(parseP2PEntry("5000 41.25 Binance")).toEqual({
      receivedUah: "5000",
      rateUahPerUsdt: "41.25",
      note: "Binance"
    });
  });

  it("parses spaced amounts and comma rates without a note", () => {
    expect(parseP2PEntry("10 000 41,25")).toEqual({
      receivedUah: "10000",
      rateUahPerUsdt: "41.25",
      note: null
    });
  });

  it("rejects a single number", () => {
    expect(parseP2PEntry("5000")).toBeNull();
  });
});

describe("cash format", () => {
  it("parses UAH cash withdrawals", () => {
    expect(parseCashEntry("10000 UAH 41.2 Cashalot")).toEqual({
      receivedAmount: "10000",
      receivedCurrency: "UAH",
      rate: "41.2",
      place: "Cashalot"
    });
  });

  it("parses USD cash withdrawals", () => {
    expect(parseCashEntry("500 USD 1 Cashalot")).toEqual({
      receivedAmount: "500",
      receivedCurrency: "USD",
      rate: "1",
      place: "Cashalot"
    });
  });

  it("defaults the currency to UAH", () => {
    expect(parseCashEntry("10000 41.2")).toEqual({
      receivedAmount: "10000",
      receivedCurrency: "UAH",
      rate: "41.2",
      place: null
    });
  });

  it("refuses USDT as a cash currency", () => {
    expect(parseCashEntry("10000 USDT 41.2")).toBeNull();
  });
});

describe("flip format", () => {
  it("parses a positive PnL", () => {
    expect(parseFlipEntry("+35.5 Buff → TM")).toEqual({ pnl: "35.5", setup: "Buff → TM" });
  });

  it("parses a negative PnL", () => {
    expect(parseFlipEntry("-12 Site → Steam")).toEqual({ pnl: "-12", setup: "Site → Steam" });
  });

  it("accepts a comma separator", () => {
    expect(parseFlipEntry("+12,75 Buff → TM")).toEqual({ pnl: "12.75", setup: "Buff → TM" });
  });

  it("requires a setup", () => {
    expect(parseFlipEntry("+35.5")).toBeNull();
  });
});

describe("expected money format", () => {
  it("parses amount, currency and title", () => {
    expect(parseExpectedEntry("250 USDT холд біржі")).toEqual({ amount: "250", currency: "USDT", title: "холд біржі" });
  });

  it("defaults to USDT", () => {
    expect(parseExpectedEntry("500 холд")).toEqual({ amount: "500", currency: "USDT", title: "холд" });
  });

  it("keeps an explicit UAH currency", () => {
    expect(parseExpectedEntry("500 UAH борг")).toEqual({ amount: "500", currency: "UAH", title: "борг" });
  });
});
