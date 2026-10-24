// Chart colours come from CSS variables so every colour theme can repaint them.
const v = (name: string) => `hsl(var(--${name}))`;

export const PROFIT_COLOR = v("profit");
export const LOSS_COLOR = v("loss");
export const CHART_COLORS = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => v(`chart-${n}`));
export const LOSS_COLORS = [v("loss"), ...[2, 3, 4, 5, 6, 7, 8].map((n) => v(`lose-${n}`))];
