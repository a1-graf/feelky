/**
 * Pure parsers for the "type one line and it is saved" Telegram input.
 * Everything money-related stays a normalized decimal string so the callers can
 * hand it straight to Decimal.js / Prisma Decimal without touching JS numbers.
 */

export type TelegramCurrency = "UAH" | "USDT" | "USD";

const THIN_SPACES = "\\u00A0\\u202F\\u2009\\u2007";
const SPACE_CLASS = `[ ${THIN_SPACES}]`;
const SPACES_RE = new RegExp(`[ ${THIN_SPACES}]`, "g");
const AMOUNT_RE = new RegExp(`^(\\d{1,3}(?:${SPACE_CLASS}\\d{3})+|\\d+)(?:[.,](\\d{1,6}))?`);
const CURRENCY_RE = new RegExp(`^${SPACE_CLASS}*(₴|\\$|\\p{L}+\\.?)`, "u");
const SIGN_RE = new RegExp(`^([+＋]|[-−–—])${SPACE_CLASS}*`);
const PREFIX_SYMBOL_RE = new RegExp(`^([₴$])${SPACE_CLASS}*`);

const CURRENCY_ALIASES: Record<string, TelegramCurrency> = {
  uah: "UAH",
  "₴": "UAH",
  грн: "UAH",
  гривня: "UAH",
  гривні: "UAH",
  гривень: "UAH",
  usdt: "USDT",
  тезер: "USDT",
  юсдт: "USDT",
  usd: "USD",
  $: "USD",
  дол: "USD",
  долар: "USD",
  долари: "USD",
  доларів: "USD"
};

export function normalizeSpaces(text: string): string {
  return text.replace(SPACES_RE, " ").replace(/\s+/g, " ").trim();
}

/** Reads a leading amount, tolerating `1 250,50`, `1250.50` and `1250`. */
export function readAmount(text: string): { value: string; rest: string } | null {
  const match = AMOUNT_RE.exec(text);
  if (!match) return null;
  const whole = match[1].replace(SPACES_RE, "");
  const value = match[2] ? `${whole}.${match[2]}` : whole;
  return { value, rest: text.slice(match[0].length) };
}

/** Reads an optional currency token right after the amount. Returns null when the token is not a currency. */
export function readCurrency(text: string): { currency: TelegramCurrency; rest: string } | null {
  const match = CURRENCY_RE.exec(text);
  if (!match) return null;
  const token = match[1].toLowerCase().replace(/\.$/, "");
  const currency = CURRENCY_ALIASES[token];
  if (!currency) return null;
  return { currency, rest: text.slice(match[0].length) };
}

/**
 * Resolves `#Повернення боргу решта` against the real reference names of the user:
 * the longest existing name that prefixes the text wins, the remainder becomes a note.
 */
export function resolveReferenceName(text: string, names: string[]): { name: string | null; rest: string } {
  const cleaned = normalizeSpaces(text);
  if (!cleaned) return { name: null, rest: "" };
  const lower = cleaned.toLowerCase();
  const sorted = [...names].filter(Boolean).sort((a, b) => b.length - a.length);
  for (const name of sorted) {
    const candidate = name.toLowerCase();
    if (lower === candidate) return { name, rest: "" };
    if (lower.startsWith(`${candidate} `)) return { name, rest: cleaned.slice(candidate.length).trim() };
  }
  const [first, ...restWords] = cleaned.split(" ");
  return { name: first || null, rest: restWords.join(" ") };
}

export type TagAndNote = {
  tag: string | null;
  tagProvided: boolean;
  note: string | null;
};

export function splitTagAndNote(text: string, names: string[] = []): TagAndNote {
  const cleaned = normalizeSpaces(text);
  if (!cleaned) return { tag: null, tagProvided: false, note: null };
  const hashIndex = cleaned.indexOf("#");
  if (hashIndex < 0) return { tag: null, tagProvided: false, note: cleaned || null };
  const before = cleaned.slice(0, hashIndex).trim();
  const resolved = resolveReferenceName(cleaned.slice(hashIndex + 1), names);
  const note = [before, resolved.rest].filter(Boolean).join(" ").trim();
  return { tag: resolved.name, tagProvided: true, note: note || null };
}

export type QuickEntry = {
  kind: "expense" | "income";
  hasExplicitSign: boolean;
  amount: string;
  currency: TelegramCurrency | null;
  tag: string | null;
  tagProvided: boolean;
  note: string | null;
};

/**
 * `- 1 250,50 грн продукти`, `+ 300 USDT #Боти виплата`, `250 кава`.
 * `names` are the user's existing categories / income sources so multi-word tags resolve correctly.
 */
export function parseQuickEntry(text: string, names: string[] = []): QuickEntry | null {
  let rest = text.trim();
  if (!rest) return null;

  let kind: "expense" | "income" = "expense";
  let hasExplicitSign = false;
  const sign = SIGN_RE.exec(rest);
  if (sign) {
    kind = sign[1] === "+" || sign[1] === "＋" ? "income" : "expense";
    hasExplicitSign = true;
    rest = rest.slice(sign[0].length);
  }

  let currency: TelegramCurrency | null = null;
  const prefixSymbol = PREFIX_SYMBOL_RE.exec(rest);
  if (prefixSymbol) {
    currency = prefixSymbol[1] === "₴" ? "UAH" : "USD";
    rest = rest.slice(prefixSymbol[0].length);
  }

  const amount = readAmount(rest);
  if (!amount) return null;
  rest = amount.rest;

  if (!currency) {
    const parsed = readCurrency(rest);
    if (parsed) {
      currency = parsed.currency;
      rest = parsed.rest;
    }
  }

  const tail = splitTagAndNote(rest, names);
  return {
    kind,
    hasExplicitSign,
    amount: amount.value,
    currency,
    tag: tail.tag,
    tagProvided: tail.tagProvided,
    note: tail.note
  };
}

export type P2PEntry = {
  receivedUah: string;
  rateUahPerUsdt: string;
  note: string | null;
};

/** `5000 41.25 Binance` -> received UAH, UAH/USDT rate, note. */
export function parseP2PEntry(text: string): P2PEntry | null {
  const received = readAmount(text.trim());
  if (!received) return null;
  const rate = readAmount(received.rest.trim());
  if (!rate) return null;
  return {
    receivedUah: received.value,
    rateUahPerUsdt: rate.value,
    note: normalizeSpaces(rate.rest) || null
  };
}

export type CashEntry = {
  receivedAmount: string;
  receivedCurrency: "UAH" | "USD";
  rate: string;
  place: string | null;
};

/** `10000 UAH 41.2 Cashalot` / `500 USD 1 Cashalot`. Currency defaults to UAH. */
export function parseCashEntry(text: string): CashEntry | null {
  const received = readAmount(text.trim());
  if (!received) return null;
  let rest = received.rest;
  let receivedCurrency: "UAH" | "USD" = "UAH";
  const currency = readCurrency(rest);
  if (currency) {
    if (currency.currency === "USDT") return null;
    receivedCurrency = currency.currency;
    rest = currency.rest;
  }
  const rate = readAmount(rest.trim());
  if (!rate) return null;
  return {
    receivedAmount: received.value,
    receivedCurrency,
    rate: rate.value,
    place: normalizeSpaces(rate.rest) || null
  };
}

export type ExpectedEntry = {
  amount: string;
  currency: TelegramCurrency;
  title: string | null;
};

/** `250 USDT холд біржі`. Without a currency token the amount is treated as USDT. */
export function parseExpectedEntry(text: string): ExpectedEntry | null {
  const parsed = parseQuickEntry(text);
  if (!parsed) return null;
  const title = [parsed.tag, parsed.note].filter(Boolean).join(" ").trim();
  return {
    amount: parsed.amount,
    currency: parsed.currency || "USDT",
    title: title || null
  };
}

export type FlipEntry = {
  pnl: string;
  setup: string;
};

/** `+35.5 Buff → TM` / `-12 Site → Steam`. */
export function parseFlipEntry(text: string): FlipEntry | null {
  let rest = text.trim();
  let negative = false;
  const sign = SIGN_RE.exec(rest);
  if (sign) {
    negative = sign[1] !== "+" && sign[1] !== "＋";
    rest = rest.slice(sign[0].length);
  }
  const amount = readAmount(rest);
  if (!amount) return null;
  const setup = normalizeSpaces(amount.rest);
  if (!setup) return null;
  return { pnl: negative ? `-${amount.value}` : amount.value, setup };
}
