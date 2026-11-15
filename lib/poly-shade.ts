export const SHADE_STEPS = 10;
/** Day result (USD) at which the brightest shade is reached; anything above stays at step 10. */
export const SHADE_CAP = 500;
const STEP_SIZE = SHADE_CAP / SHADE_STEPS;

/** 0 for a flat day, otherwise 1..10: every 50 of profit or loss is one step, 450 and more is the brightest. */
export function shadeStep(pnl: number): number {
  const size = Math.abs(pnl);
  if (size < 0.005) return 0;
  return Math.min(SHADE_STEPS, Math.max(1, Math.ceil(size / STEP_SIZE - 1e-9)));
}

/** Background of a day cell: dull at step 1, full colour at step 10. Green for profit, red for loss. */
export function shadeColor(step: number, profit: boolean): string {
  const t = (step - 1) / (SHADE_STEPS - 1);
  return profit
    ? `hsl(142 ${Math.round(42 + 27 * t)}% ${Math.round(19 + 39 * t)}%)`
    : `hsl(0 ${Math.round(50 + 34 * t)}% ${Math.round(24 + 42 * t)}%)`;
}

function luminance(hue: number, saturation: number, lightness: number): number {
  const s = saturation / 100;
  const l = lightness / 100;
  const a = s * Math.min(l, 1 - l);
  const channel = (n: number) => {
    const k = (n + hue / 30) % 12;
    const value = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(8) + 0.0722 * channel(4);
}

/** Black digits when they contrast more with the cell colour than white digits do (always at least 4.5:1 on these palettes). */
export function shadeTextDark(step: number, profit: boolean): boolean {
  const [h, s, l] = profit
    ? [
        142,
        42 + 27 * ((step - 1) / (SHADE_STEPS - 1)),
        19 + 39 * ((step - 1) / (SHADE_STEPS - 1)),
      ]
    : [
        0,
        50 + 34 * ((step - 1) / (SHADE_STEPS - 1)),
        24 + 42 * ((step - 1) / (SHADE_STEPS - 1)),
      ];
  const lum = luminance(h, Math.round(s), Math.round(l));
  return (lum + 0.05) / 0.05 > 1.05 / (lum + 0.05);
}
