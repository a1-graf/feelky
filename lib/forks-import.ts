import { forkInputSchema } from "@/lib/forks-input";
import type { ForkInputParsed } from "@/lib/forks-input";
import { upsertFork } from "@/lib/forks";

/**
 * The vilky journal (tools/vilky-notify/state.json) keeps a fork as `{id, date: "DD.MM", time: "HH:MM", legs: [{bk, pick, odds, amt: "6.60 USDT" | "$8.57"}], ...}`.
 * This turns one such record into the agent payload; ids are the journal ids, so running an import again changes nothing.
 */

export type JournalLeg = { bk: string; pick: string; odds: number; amt: string };
export type JournalFork = {
  id: string;
  date: string;
  time: string;
  sport?: string;
  match: string;
  legs: JournalLeg[];
  tags?: string[];
  total: number;
  status: "open" | "settled";
  pnl?: number;
  guar?: number;
};

/** "6.60 USDT" / "$8.57" -> "6.60" */
export function journalAmount(text: string): string {
  const match = /(\d+(?:\.\d+)?)/.exec(text.replace(",", "."));
  if (!match) throw new Error(`Не вдалося розібрати суму «${text}»`);
  return match[1];
}

/** Kyiv wall-clock "DD.MM" + "HH:MM" -> instant. The year is the reference year, or the previous one when that would be in the future. */
export function journalPlacedAt(date: string, time: string, now: Date = new Date()): Date {
  const [day, month] = date.split(".").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const build = (year: number) => {
    const guess = Date.UTC(year, month - 1, day, hour, minute);
    const offset = (instant: number) => {
      const name = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Kyiv", timeZoneName: "shortOffset" }).formatToParts(new Date(instant)).find((part) => part.type === "timeZoneName")?.value ?? "GMT+2";
      const parsed = /GMT([+-])(\d{1,2})/.exec(name);
      return parsed ? (parsed[1] === "-" ? -1 : 1) * Number(parsed[2]) * 3_600_000 : 7_200_000;
    };
    return new Date(guess - offset(guess - offset(guess)));
  };
  const year = now.getUTCFullYear();
  const current = build(year);
  return current.getTime() > now.getTime() + 86_400_000 ? build(year - 1) : current;
}

export function forkFromJournal(fork: JournalFork, now: Date = new Date()): ForkInputParsed {
  return forkInputSchema.parse({
    externalId: fork.id,
    status: fork.status === "settled" ? "SETTLED" : "OPEN",
    placedAt: journalPlacedAt(fork.date, fork.time, now),
    sport: fork.sport || null,
    match: fork.match,
    tags: fork.tags ?? [],
    legs: fork.legs.slice(0, 2).map((leg) => ({ book: leg.bk, pick: leg.pick, odds: String(leg.odds), stake: journalAmount(leg.amt) })),
    total: String(fork.total),
    pnl: fork.status === "settled" && fork.pnl != null ? String(fork.pnl) : null,
    guaranteed: fork.status === "open" && fork.guar != null ? String(fork.guar) : null
  });
}

export function buildForksImportPlan(journal: Record<string, JournalFork>, now: Date = new Date()): ForkInputParsed[] {
  return Object.values(journal)
    .map((fork) => forkFromJournal(fork, now))
    .sort((a, b) => a.placedAt.getTime() - b.placedAt.getTime());
}

export async function runForksImport(userId: string, journal: Record<string, JournalFork>) {
  const result = { created: 0, updated: 0, duplicate: 0 };
  for (const input of buildForksImportPlan(journal)) {
    const { duplicate, updated } = await upsertFork(userId, input);
    if (updated) result.updated += 1;
    else if (duplicate) result.duplicate += 1;
    else result.created += 1;
  }
  return result;
}
