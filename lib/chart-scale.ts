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

/** Short axis label, always 2 decimals: 150,00, -1,50k, 12,00k. */
export function shortAxisValue(value: number) {
  const format = (n: number) => new Intl.NumberFormat("uk-UA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  if (Math.abs(value) >= 1000) return `${format(value / 1000)}k`;
  return format(value);
}

/** Round ticks around a value range that need not include zero (balances): e.g. 1 180..1 420 -> 1 150, 1 200, ... 1 450. */
export function niceRange(low: number, high: number, maxSteps = 4): NiceScale {
  if (!Number.isFinite(low) || !Number.isFinite(high)) return { domain: [0, 1], ticks: [0, 1] };
  if (high - low < 1e-9) {
    const pad = Math.max(1, Math.abs(high) * 0.05);
    return niceRange(low - pad, high + pad, maxSteps);
  }
  const magnitude = 10 ** Math.floor(Math.log10((high - low) / maxSteps));
  for (const multiplier of STEP_MULTIPLIERS) {
    const step = multiplier * magnitude;
    const start = Math.floor(low / step) * step;
    const end = Math.ceil(high / step) * step;
    const count = Math.round((end - start) / step);
    if (count > maxSteps) continue;
    const ticks = Array.from({ length: count + 1 }, (_, index) => Number((start + index * step).toFixed(10)));
    return { domain: [ticks[0], ticks[ticks.length - 1]], ticks };
  }
  return { domain: [low, high], ticks: [low, high] };
}

/** Evenly spread timestamps from start to end for an X axis. */
export function timeTicks(start: number, end: number, count = 4): number[] {
  if (end <= start) return [start];
  return Array.from({ length: count }, (_, index) => Math.round(start + ((end - start) * index) / (count - 1)));
}

/** Where zero sits inside a box spanning [low, high], measured from the top; feeds the green/red split of a signed line. */
export function zeroOffset(low: number, high: number) {
  if (high <= 0) return 0;
  if (low >= 0) return 1;
  return high / (high - low);
}

/**
 * Turns an event-driven running series (steps at irregular moments) into an evenly spaced one, so the curve
 * flows instead of spiking: each step becomes a short ramp. The first and last points keep their exact values.
 */
export function resampleSeries<T extends { t: number; total: number }>(points: T[], buckets = 80): { t: number; total: number; delta: number }[] {
  if (points.length < 2 || buckets < 2) return points.map((point, index) => ({ t: point.t, total: point.total, delta: index ? point.total - points[index - 1].total : 0 }));
  const start = points[0].t;
  const end = points[points.length - 1].t;
  if (end <= start) return points.map((point) => ({ t: point.t, total: point.total, delta: 0 }));
  const result: { t: number; total: number; delta: number }[] = [];
  let cursor = 0;
  for (let index = 0; index <= buckets; index += 1) {
    const t = index === buckets ? end : start + ((end - start) * index) / buckets;
    while (cursor + 1 < points.length && points[cursor + 1].t <= t) cursor += 1;
    const total = index === buckets ? points[points.length - 1].total : points[cursor].total;
    result.push({ t, total, delta: index ? total - result[index - 1].total : 0 });
  }
  return result;
}
