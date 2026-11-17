import Decimal from "decimal.js";
import { prisma } from "@/lib/db";
import { D } from "@/lib/money";

/**
 * The market UAH/USDT rate: what selling USDT for hryvnia on Binance P2P actually pays (Monobank,
 * deals from 1 000 UAH). If Binance does not answer, a rate pushed by the OpenClaw server is used,
 * then the official NBU dollar rate, then the last rate that was ever known. A broken source never
 * throws: the caller always gets a rate or null.
 */

export type MarketRateSource = "BINANCE_P2P" | "SERVER_PUSH" | "NBU" | "LAST_KNOWN";

export type MarketRate = {
  rate: string;
  source: MarketRateSource;
  /** Where the number originally came from (for LAST_KNOWN: the source it had back then). */
  origin: MarketRateSource;
  fetchedAt: string;
  /** True when it is older than the cache window and every live source failed. */
  stale: boolean;
};

export const MARKET_RATE_TTL_MS = 10 * 60 * 1000;
/** A pushed rate is trusted for a while longer than the cache, so a missed push does not drop to NBU. */
export const PUSHED_RATE_MAX_AGE_MS = 30 * 60 * 1000;
const FETCH_TIMEOUT_MS = 3500;
const MARKET_KEY = "uahUsdtMarketRate";
const PUSHED_KEY = "uahUsdtPushedRate";
export const P2P_MIN_DEAL_UAH = 1000;
const P2P_PAY_TYPE = "Monobank";
const TOP_ADS = 5;

export const MARKET_SOURCE_LABELS: Record<MarketRateSource, string> = {
  BINANCE_P2P: "Binance P2P",
  SERVER_PUSH: "Binance P2P через сервер",
  NBU: "НБУ",
  LAST_KNOWN: "останнє відоме"
};

/** A sane UAH per USDT rate: anything outside is a parsing error, not a market. */
export function isSaneRate(value: Decimal.Value | null | undefined) {
  if (value == null) return false;
  try {
    const rate = D(value);
    return rate.isFinite() && rate.gte(20) && rate.lte(200);
  } catch {
    return false;
  }
}

export function median(values: Decimal[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a.comparedTo(b));
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : sorted[middle - 1].plus(sorted[middle]).div(2);
}

type BinanceAd = {
  adv?: {
    price?: string;
    minSingleTransAmount?: string;
    maxSingleTransAmount?: string;
    tradeMethods?: { identifier?: string; tradeMethodName?: string }[];
  };
};

/**
 * Median of the first five ads where USDT can be sold for UAH to a Monobank card with a 1 000 UAH deal.
 * Binance lists the best price for the seller first, so this is a realistic top, not one outlier.
 */
export function pickBinanceRate(payload: unknown): Decimal | null {
  const data = (payload as { data?: BinanceAd[] } | null)?.data;
  if (!Array.isArray(data)) return null;
  const prices: Decimal[] = [];
  for (const item of data) {
    const adv = item?.adv;
    if (!adv || !isSaneRate(adv.price)) continue;
    const methods = adv.tradeMethods ?? [];
    if (methods.length && !methods.some((method) => method.identifier === P2P_PAY_TYPE || method.tradeMethodName === P2P_PAY_TYPE)) continue;
    const min = D(adv.minSingleTransAmount || 0);
    const max = D(adv.maxSingleTransAmount || 0);
    if (min.gt(P2P_MIN_DEAL_UAH) || (max.gt(0) && max.lt(P2P_MIN_DEAL_UAH))) continue;
    prices.push(D(adv.price as string));
    if (prices.length === TOP_ADS) break;
  }
  return median(prices);
}

/** NBU answers `[{ cc: "USD", rate: 45.34, ... }]`. */
export function parseNbuRate(payload: unknown): Decimal | null {
  if (!Array.isArray(payload)) return null;
  const usd = payload.find((item) => item && typeof item === "object" && (item as { cc?: string }).cc === "USD") as { rate?: number } | undefined;
  return usd && isSaneRate(usd.rate) ? D(usd.rate as number) : null;
}

/** Average of the user's own last P2P withdrawal rates (most recent first). */
export function averageOfRates(rates: (Decimal.Value | null | undefined)[], limit = 10) {
  const valid = rates.filter((rate): rate is Decimal.Value => isSaneRate(rate)).slice(0, limit).map((rate) => D(rate));
  if (!valid.length) return null;
  return { rate: valid.reduce((sum, rate) => sum.plus(rate), new Decimal(0)).div(valid.length), count: valid.length };
}

async function fetchJson(url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchBinanceP2PRate(): Promise<Decimal | null> {
  const payload = await fetchJson("https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0 (compatible; Feelky/1.0)" },
    body: JSON.stringify({
      fiat: "UAH",
      asset: "USDT",
      // From the user's side: they SELL USDT, so these are the ads of people buying it.
      tradeType: "SELL",
      page: 1,
      rows: 10,
      payTypes: [P2P_PAY_TYPE],
      transAmount: String(P2P_MIN_DEAL_UAH),
      publisherType: null,
      countries: []
    })
  });
  return pickBinanceRate(payload);
}

export async function fetchNbuRate(): Promise<Decimal | null> {
  return parseNbuRate(await fetchJson("https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?valcode=USD&json"));
}

type Stored = { rate: string; source: MarketRateSource; fetchedAt: string };

function parseStored(value: string | null | undefined): Stored | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<Stored>;
    if (!isSaneRate(parsed.rate) || !parsed.fetchedAt || Number.isNaN(Date.parse(parsed.fetchedAt))) return null;
    const source = parsed.source && parsed.source in MARKET_SOURCE_LABELS ? parsed.source : "LAST_KNOWN";
    return { rate: D(parsed.rate as string).toString(), source, fetchedAt: new Date(parsed.fetchedAt).toISOString() };
  } catch {
    return null;
  }
}

export type MarketRateDeps = {
  now: Date;
  readStored: () => Promise<Stored | null>;
  readPushed: () => Promise<Stored | null>;
  writeStored: (value: Stored) => Promise<void>;
  fetchBinance: () => Promise<Decimal | null>;
  fetchNbu: () => Promise<Decimal | null>;
  log?: (message: string) => void;
};

const quietly = async <T>(work: () => Promise<T>, log: (message: string) => void, label: string): Promise<T | null> => {
  try {
    return await work();
  } catch (error) {
    log(`[market-rate] ${label} failed: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
};

/** The source order, with every step allowed to fail. Pure apart from the injected dependencies. */
export async function resolveMarketRate(deps: MarketRateDeps): Promise<MarketRate | null> {
  const log = deps.log ?? (() => undefined);
  const nowMs = deps.now.getTime();
  const age = (stored: Stored) => nowMs - Date.parse(stored.fetchedAt);
  const fresh = (stored: Stored): MarketRate => ({ ...stored, origin: stored.source, stale: false });

  const stored = await quietly(deps.readStored, log, "read cache");
  if (stored && age(stored) >= 0 && age(stored) < MARKET_RATE_TTL_MS) return fresh(stored);

  const save = async (value: Stored) => {
    await quietly(() => deps.writeStored(value), log, "write cache");
    return fresh(value);
  };
  const stamp = deps.now.toISOString();

  const pushed = await quietly(deps.readPushed, log, "read pushed");
  // A fresh server push is as good as a live Binance read and costs no outbound call.
  if (pushed && age(pushed) < MARKET_RATE_TTL_MS) return save({ ...pushed, source: "SERVER_PUSH" });

  const binance = await quietly(deps.fetchBinance, log, "Binance P2P");
  if (binance && isSaneRate(binance)) return save({ rate: binance.toDecimalPlaces(4).toString(), source: "BINANCE_P2P", fetchedAt: stamp });

  if (pushed && age(pushed) < PUSHED_RATE_MAX_AGE_MS) return save({ ...pushed, source: "SERVER_PUSH" });

  const nbu = await quietly(deps.fetchNbu, log, "NBU");
  if (nbu && isSaneRate(nbu)) return save({ rate: nbu.toDecimalPlaces(4).toString(), source: "NBU", fetchedAt: stamp });

  if (stored) return { ...stored, source: "LAST_KNOWN", origin: stored.source, stale: true };
  if (pushed) return { ...pushed, source: "LAST_KNOWN", origin: "SERVER_PUSH", stale: true };
  return null;
}

let memory: { value: MarketRate; checkedAt: number } | null = null;
let inFlight: Promise<MarketRate | null> | null = null;

async function readConfig(key: string) {
  const row = await prisma.appConfig.findUnique({ where: { key } });
  return parseStored(row?.value);
}

/** The cached market rate: memory for this instance, the database across instances, live sources every 10 minutes. */
export async function getMarketRate(): Promise<MarketRate | null> {
  const nowMs = Date.now();
  if (memory && !memory.value.stale && nowMs - memory.checkedAt < MARKET_RATE_TTL_MS && nowMs - Date.parse(memory.value.fetchedAt) < MARKET_RATE_TTL_MS) {
    return memory.value;
  }
  if (!inFlight) {
    inFlight = resolveMarketRate({
      now: new Date(nowMs),
      readStored: () => readConfig(MARKET_KEY),
      readPushed: () => readConfig(PUSHED_KEY),
      writeStored: async (value) => {
        const json = JSON.stringify(value);
        await prisma.appConfig.upsert({ where: { key: MARKET_KEY }, create: { key: MARKET_KEY, value: json }, update: { value: json } });
      },
      fetchBinance: fetchBinanceP2PRate,
      fetchNbu: fetchNbuRate,
      log: (message) => console.warn(message)
    })
      .then((value) => {
        memory = value ? { value, checkedAt: Date.now() } : null;
        return value;
      })
      .catch(() => null)
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

/** The OpenClaw server sends the Binance P2P rate here when Vercel itself cannot reach Binance. */
export async function savePushedRate(input: { rate: Decimal.Value; fetchedAt?: Date }) {
  if (!isSaneRate(input.rate)) throw new Error("Курс має бути між 20 і 200 UAH за USDT");
  const fetchedAt = input.fetchedAt && !Number.isNaN(input.fetchedAt.getTime()) && input.fetchedAt.getTime() <= Date.now() + 60_000 ? input.fetchedAt : new Date();
  const value: Stored = { rate: D(input.rate).toDecimalPlaces(4).toString(), source: "SERVER_PUSH", fetchedAt: fetchedAt.toISOString() };
  const json = JSON.stringify(value);
  await prisma.appConfig.upsert({ where: { key: PUSHED_KEY }, create: { key: PUSHED_KEY, value: json }, update: { value: json } });
  memory = null;
  return value;
}

export function resetMarketRateMemory() {
  memory = null;
}
