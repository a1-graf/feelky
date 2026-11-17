import type { RateInfo } from "@/lib/dashboard";

const kyivTime = new Intl.DateTimeFormat("uk-UA", { timeZone: "Europe/Kyiv", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** `18.11, 23:50` in Kyiv time. */
export function formatKyivStamp(iso: string | Date) {
  return kyivTime.format(typeof iso === "string" ? new Date(iso) : iso);
}

/** One line under the rate: which rate is used, where the market one came from and when. */
export function rateSourceLine(info: RateInfo) {
  const market = info.market ? `${info.market.label}, оновлено ${formatKyivStamp(info.market.fetchedAt)}` : "ринковий курс недоступний";
  if (info.mode === "MANUAL" && info.source === "Ручний курс") return `Ручний курс · ринковий: ${market}`;
  if (info.mode === "P2P_AVERAGE" && info.myAverage && info.source.startsWith("Мій")) return `${info.source} · ринковий: ${market}`;
  return info.market ? `Ринковий · ${market}` : info.source;
}
