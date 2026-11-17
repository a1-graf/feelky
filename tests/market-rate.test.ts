import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { averageOfRates, isSaneRate, median, parseNbuRate, pickBinanceRate, resolveMarketRate, type MarketRateDeps } from "@/lib/market-rate";

const ad = (price: string, min = "1000", max = "50000", methods = ["Monobank"]) => ({
  adv: { price, minSingleTransAmount: min, maxSingleTransAmount: max, tradeMethods: methods.map((identifier) => ({ identifier })) }
});

describe("market rate parsing", () => {
  it("takes the median of the first five Monobank ads that accept a 1 000 UAH deal", () => {
    const payload = {
      data: [
        ad("46.62"),
        ad("49.00", "5000"), // minimum deal above 1 000 UAH
        ad("48.00", "100", "500"), // maximum below 1 000 UAH
        ad("47.50", "1000", "9000", ["PrivatBank"]),
        ad("46.32", "800"),
        ad("46.31", "400"),
        ad("46.27"),
        ad("46.21"),
        ad("40.00")
      ]
    };
    expect(pickBinanceRate(payload)?.toString()).toBe("46.31");
  });

  it("returns null for an empty or broken answer", () => {
    expect(pickBinanceRate({ data: [] })).toBeNull();
    expect(pickBinanceRate({ code: "403" })).toBeNull();
    expect(pickBinanceRate(null)).toBeNull();
  });

  it("reads the NBU dollar rate", () => {
    expect(parseNbuRate([{ cc: "USD", rate: 45.3436 }])?.toString()).toBe("45.3436");
    expect(parseNbuRate({ error: true })).toBeNull();
    expect(parseNbuRate([{ cc: "USD", rate: 0 }])).toBeNull();
  });

  it("averages the last ten own P2P rates", () => {
    const rates = ["45.66", "45.49", "45.61", "45.8", "45.92", "45.65", "45.26", "45.1", "45.92", "44.3", "40"];
    const result = averageOfRates(rates);
    expect(result?.count).toBe(10);
    expect(result?.rate.toString()).toBe("45.471");
    expect(averageOfRates([])).toBeNull();
  });

  it("knows a sane rate and a median", () => {
    expect(isSaneRate("46.3")).toBe(true);
    expect(isSaneRate("4.63")).toBe(false);
    expect(isSaneRate("abc")).toBe(false);
    expect(median([new Decimal(1), new Decimal(3), new Decimal(2), new Decimal(4)])?.toString()).toBe("2.5");
  });
});

describe("market rate source order", () => {
  const now = new Date("2026-11-18T10:00:00.000Z");
  const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();
  const deps = (overrides: Partial<MarketRateDeps> = {}) => {
    const writes: unknown[] = [];
    const value: MarketRateDeps = {
      now,
      readStored: async () => null,
      readPushed: async () => null,
      writeStored: async (stored) => {
        writes.push(stored);
      },
      fetchBinance: async () => new Decimal("46.31"),
      fetchNbu: async () => new Decimal("45.34"),
      ...overrides
    };
    return { value, writes };
  };

  it("uses a fresh cached value without calling any source", async () => {
    let calls = 0;
    const { value } = deps({
      readStored: async () => ({ rate: "46.5", source: "BINANCE_P2P", fetchedAt: minutesAgo(3) }),
      fetchBinance: async () => {
        calls += 1;
        return new Decimal("47");
      }
    });
    const result = await resolveMarketRate(value);
    expect(result?.rate).toBe("46.5");
    expect(calls).toBe(0);
  });

  it("refreshes from Binance P2P once the cache is older than ten minutes and stores it", async () => {
    const { value, writes } = deps({ readStored: async () => ({ rate: "46.5", source: "BINANCE_P2P", fetchedAt: minutesAgo(11) }) });
    const result = await resolveMarketRate(value);
    expect(result).toMatchObject({ rate: "46.31", source: "BINANCE_P2P", stale: false });
    expect(writes).toHaveLength(1);
  });

  it("prefers a fresh server push, then Binance, then a recent push, then NBU", async () => {
    const pushedFresh = deps({ readPushed: async () => ({ rate: "46.7", source: "SERVER_PUSH", fetchedAt: minutesAgo(2) }) });
    expect((await resolveMarketRate(pushedFresh.value))?.source).toBe("SERVER_PUSH");

    const pushedOlder = deps({
      readPushed: async () => ({ rate: "46.7", source: "SERVER_PUSH", fetchedAt: minutesAgo(20) }),
      fetchBinance: async () => {
        throw new Error("HTTP 451");
      }
    });
    expect(await resolveMarketRate(pushedOlder.value)).toMatchObject({ rate: "46.7", source: "SERVER_PUSH" });

    const nbu = deps({ fetchBinance: async () => null });
    expect(await resolveMarketRate(nbu.value)).toMatchObject({ rate: "45.34", source: "NBU" });
  });

  it("falls back to the last known value, never to a hard-coded number", async () => {
    const failing = deps({
      readStored: async () => ({ rate: "46.1", source: "BINANCE_P2P", fetchedAt: minutesAgo(600) }),
      fetchBinance: async () => {
        throw new Error("timeout");
      },
      fetchNbu: async () => {
        throw new Error("timeout");
      },
      writeStored: async () => {
        throw new Error("db down");
      }
    });
    expect(await resolveMarketRate(failing.value)).toMatchObject({ rate: "46.1", source: "LAST_KNOWN", origin: "BINANCE_P2P", stale: true });

    const nothing = deps({ fetchBinance: async () => null, fetchNbu: async () => null, readStored: async () => { throw new Error("db down"); } });
    expect(await resolveMarketRate(nothing.value)).toBeNull();
  });
});
