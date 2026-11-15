/** Plain labels shared by the server-side data builder and the client variants (no imports, safe in the browser). */

export type BreakdownKey = "market" | "price" | "hour" | "week" | "day";

export const AGENT_SLOTS = 3;
export const BREAKDOWN_TITLES: Record<BreakdownKey, string> = {
  market: "По типу ринку",
  price: "По ціні входу",
  hour: "По годинах (UTC; Київ = UTC+2)",
  week: "По тижнях",
  day: "По днях (останні 10)",
};
export const MARKET_KIND_LABELS: Record<string, string> = {
  BTC_5M: "BTC 5 хвилин",
  BTC_15M: "BTC 15 хвилин",
  ETH_5M: "ETH 5 хвилин",
  ETH_15M: "ETH 15 хвилин",
  OTHER: "Інші ринки",
};
export const kindLabel = (kind: string) => MARKET_KIND_LABELS[kind] ?? kind;
