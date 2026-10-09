// Pure helpers that keep chart axes even: round tick steps and a calendar without gaps.

export type NiceScale = { domain: [number, number]; ticks: number[] };

const STEP_MULTIPLIERS = [1, 2, 2.5, 5, 10, 20];

/** Round ticks that always include zero, e.g. -150, -100, -50, 0, 50; at most `maxSteps` gaps. */
export function niceScale(values: number[], maxSteps = 5): NiceScale {
  const finite = values.filter(Number.isFinite);
  const min = Math.min(0, ...finite);
  const max = Math.max(0, ...finite);
  if (min === max) return { domain: [-1, 1], ticks: [0] };

  const magnitude = 10 ** Math.floor(Math.log10((max - min) / maxSteps));
  // The smallest round step that fits, so the axis wastes as little height as possible.
  for (const multiplier of STEP_MULTIPLIERS) {
    const step = multiplier * magnitude;
    const low = Math.floor(min / step) * step;
    const high = Math.ceil(max / step) * step;
    const count = Math.round((high - low) / step);
    if (count > maxSteps) continue;
    const ticks = Array.from({ length: count + 1 }, (_, index) => Number((low + index * step).toFixed(10)));
    return { domain: [ticks[0], ticks[ticks.length - 1]], ticks };
  }
  return { domain: [min, max], ticks: [min, 0, max].filter((tick, index, all) => all.indexOf(tick) === index) };
}

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Every calendar day from the first to the last key, so the X axis has no uneven jumps. */
export function calendarDays(keys: string[], from?: string, to?: string, maxDays = 92): string[] {
  const sorted = [...keys].sort();
  const bounds = [from, sorted[0]].filter(Boolean).sort() as string[];
  const ends = [to, sorted[sorted.length - 1]].filter(Boolean).sort() as string[];
  const start = bounds[0];
  const end = ends[ends.length - 1];
  if (!start || !end) return sorted;

  const days: string[] = [];
  for (let day = start; day <= end; day = addDays(day, 1)) {
    days.push(day);
    // A very long range would squeeze bars into hairlines; show only the active days then.
    if (days.length > maxDays) return sorted;
  }
  return days;
}

export function dayLabel(dateKey: string) {
  return `${dateKey.slice(8, 10)}.${dateKey.slice(5, 7)}`;
}

/** Short axis label: 150, -1,5k, 12k. */
export function shortAxisValue(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1000) return `${new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 1 }).format(value / 1000)}k`;
  return new Intl.NumberFormat("uk-UA", { maximumFractionDigits: abs < 10 ? 1 : 0 }).format(value);
}
