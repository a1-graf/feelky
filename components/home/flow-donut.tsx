import { formatMoney, formatPercent } from "@/lib/money";

/** Fixed, theme-independent hues so the rings stay colourful in White, Black and Matrix alike. */
export const INCOME_COLORS: Record<string, string> = {
  "Фліпи": "#22c55e",
  "Вилки": "#3b82f6",
  "Steam": "#a855f7",
  "Форекс": "#f59e0b",
  "Polymarket": "#06b6d4",
  "Ручні доходи": "#ec4899"
};
export const COST_COLORS = ["#f97316", "#eab308", "#8b5cf6", "#0ea5e9", "#14b8a6", "#f472b6", "#84cc16", "#64748b"];
export const LOSS_COLOR = "#ef4444";

type Item = { name: string; value: number; color: string };

/** SVG ring with the total in the middle and a ranked list with amounts and shares under it. */
export function FlowDonut({ title, eyebrow, items, total, hidden, emptyLabel }: { title: string; eyebrow: string; items: Item[]; total: number; hidden: boolean; emptyLabel: string }) {
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <section className="gh-panel gh-donut-card">
      <div className="gh-heading"><div><span className="gh-eyebrow">{eyebrow}</span><h2>{title}</h2></div></div>
      {items.length && total > 0 ? (
        <>
          <div className="gh-donut">
            <svg viewBox="0 0 160 160" role="img" aria-label={title}>
              <circle cx="80" cy="80" r={radius} fill="none" stroke="var(--gh-border)" strokeWidth="18" />
              {items.map((item) => {
                const length = (item.value / total) * circumference;
                const gap = items.length > 1 ? Math.min(2, length / 3) : 0;
                const slice = <circle key={item.name} cx="80" cy="80" r={radius} fill="none" stroke={item.color} strokeWidth="18" strokeDasharray={`${Math.max(0, length - gap)} ${circumference}`} strokeDashoffset={-offset} transform="rotate(-90 80 80)" />;
                offset += length;
                return slice;
              })}
            </svg>
            <div className="gh-donut-center"><b>{formatMoney(total, "USDT", hidden)}</b><span className="gh-muted">Разом</span></div>
          </div>
          <ul className="gh-donut-list">
            {items.map((item) => (
              <li key={item.name}>
                <span className="gh-dot" style={{ background: item.color }} />
                <span className="gh-donut-name">{item.name}</span>
                <b>{formatMoney(item.value, "USDT", hidden)}</b>
                <span className="gh-muted gh-donut-share">{formatPercent((item.value / total) * 100, hidden)}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div className="gh-empty gh-empty-donut">{emptyLabel}</div>
      )}
    </section>
  );
}
