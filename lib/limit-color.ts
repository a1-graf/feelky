// [share of the limit used, hue, saturation %, lightness %]: deep green -> light green at 30% -> amber at 100% -> red from 140%.
const STOPS: [number, number, number, number][] = [
  [0, 145, 62, 36],
  [0.3, 100, 68, 54],
  [0.65, 55, 90, 50],
  [1, 36, 96, 52],
  [1.4, 0, 84, 48]
];

/** Smooth bar colour for the monthly expense limit: the less is spent the greener, the further over the limit the redder. */
export function limitColor(ratio: number): string {
  const x = Number.isFinite(ratio) ? Math.max(0, ratio) : 0;
  if (x >= STOPS[STOPS.length - 1][0]) {
    const [, h, s, l] = STOPS[STOPS.length - 1];
    return `hsl(${h} ${s}% ${l}%)`;
  }
  for (let index = 1; index < STOPS.length; index += 1) {
    const [x1, h1, s1, l1] = STOPS[index];
    if (x > x1) continue;
    const [x0, h0, s0, l0] = STOPS[index - 1];
    const k = (x - x0) / (x1 - x0);
    const mix = (a: number, b: number) => Math.round((a + (b - a) * k) * 10) / 10;
    return `hsl(${mix(h0, h1)} ${mix(s0, s1)}% ${mix(l0, l1)}%)`;
  }
  return `hsl(${STOPS[0][1]} ${STOPS[0][2]}% ${STOPS[0][3]}%)`;
}
