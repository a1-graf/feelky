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

/** Dark digits on the bright half of the scale, light digits on the dull half. */
export const shadeTextDark = (step: number) => step >= 5;
