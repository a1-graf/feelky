"use client";

import { useMemo, useState } from "react";
import { Cell, Pie, PieChart } from "recharts";

export type DonutItem = { name: string; value: number };

type Slice = DonutItem & { color: string; share: number; scale: number };

const DONUT_SIZE = 192;
const REST_COLOR = "#9aa1ad";

function amountText(value: number, currency: string, hidden: boolean) {
  if (hidden) return "••••";
  const digits = currency === "UAH" ? 0 : 2;
  return `${new Intl.NumberFormat("uk-UA", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value)} ${currency}`;
}

function shareText(share: number, hidden: boolean) {
  if (hidden) return "••";
  const percent = share * 100;
  return percent > 0 && percent < 1 ? "<1%" : `${Math.round(percent)}%`;
}

// "Витрати · Машина" reads better with the group muted and the name in front.
function SliceName({ name }: { name: string }) {
  const separator = name.indexOf(" · ");
  if (separator < 0) return <>{name}</>;
  return (
    <>
      <span className="text-[hsl(var(--card-muted-foreground))]">{name.slice(0, separator)} · </span>
      {name.slice(separator + 3)}
    </>
  );
}

/**
 * A fixed-size donut with the total in the middle and a ranked legend beside it. Every row shows
 * the amount, the share and a thin bar, so the columns line up however long the names are.
 */
export function DonutBreakdown({
  items,
  colors,
  currency,
  hidden = false,
  totalLabel = "Загалом",
  emptyLabel,
  maxSlices = 8
}: {
  items: DonutItem[];
  colors: string[];
  currency: string;
  hidden?: boolean;
  totalLabel?: string;
  emptyLabel: string;
  maxSlices?: number;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const { slices, total } = useMemo(() => {
    const positive = items.filter((item) => Number.isFinite(item.value) && item.value > 0).sort((a, b) => b.value - a.value);
    const sum = positive.reduce((result, item) => result + item.value, 0);
    const head = positive.length > maxSlices ? positive.slice(0, maxSlices - 1) : positive;
    const rest = positive.slice(head.length).reduce((result, item) => result + item.value, 0);
    const largest = Math.max(head[0]?.value ?? 0, rest);
    // Bars are measured against the largest row, so the top row is full and the rest read as a ranking.
    const prepared: Slice[] = head.map((item, index) => ({ ...item, color: colors[index % colors.length], share: item.value / sum, scale: item.value / largest }));
    if (rest > 0) prepared.push({ name: "Решта", value: rest, color: REST_COLOR, share: rest / sum, scale: rest / largest });
    return { slices: prepared, total: sum };
  }, [items, colors, maxSlices]);

  if (!slices.length || total <= 0) {
    if (!emptyLabel) return null;
    return <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-border text-sm text-[hsl(var(--card-muted-foreground))]">{emptyLabel}</div>;
  }

  const active = activeIndex === null ? null : slices[activeIndex];

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-8">
      <div className="relative shrink-0" style={{ width: DONUT_SIZE, height: DONUT_SIZE }}>
        <PieChart width={DONUT_SIZE} height={DONUT_SIZE}>
          <Pie
            data={slices}
            dataKey="value"
            nameKey="name"
            innerRadius={68}
            outerRadius={94}
            startAngle={90}
            endAngle={-270}
            paddingAngle={slices.length > 1 ? 2 : 0}
            cornerRadius={3}
            stroke="none"
            isAnimationActive={false}
            onMouseEnter={(_, index) => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(null)}
          >
            {slices.map((slice, index) => (
              <Cell key={slice.name} fill={slice.color} fillOpacity={activeIndex === null || activeIndex === index ? 1 : 0.3} />
            ))}
          </Pie>
        </PieChart>
        <div className="pointer-events-none absolute inset-[30px] flex flex-col items-center justify-center text-center">
          <div className="max-w-full truncate text-xs text-[hsl(var(--card-muted-foreground))]">{active ? active.name.split(" · ").pop() : totalLabel}</div>
          <div className="mt-0.5 text-base font-bold tabular-nums leading-tight">{amountText(active ? active.value : total, currency, hidden)}</div>
          {active && <div className="mt-0.5 text-xs font-medium tabular-nums" style={{ color: active.color }}>{shareText(active.share, hidden)}</div>}
        </div>
      </div>

      <ul className="w-full min-w-0 flex-1 space-y-2.5" onMouseLeave={() => setActiveIndex(null)}>
        {slices.map((slice, index) => (
          <li
            key={slice.name}
            className={`transition-opacity ${activeIndex === null || activeIndex === index ? "opacity-100" : "opacity-50"}`}
            onMouseEnter={() => setActiveIndex(index)}
          >
            <div className="flex items-center gap-2 text-sm">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} />
              <span className="min-w-0 flex-1 truncate"><SliceName name={slice.name} /></span>
              <span className="shrink-0 font-medium tabular-nums">{amountText(slice.value, currency, hidden)}</span>
              <span className="w-10 shrink-0 text-right tabular-nums text-[hsl(var(--card-muted-foreground))]">{shareText(slice.share, hidden)}</span>
            </div>
            <div className="ml-[18px] mt-1 h-1 overflow-hidden rounded-full bg-[hsl(var(--muted))]">
              <div className="h-full rounded-full" style={{ width: `${Math.max(slice.scale * 100, 2)}%`, backgroundColor: slice.color }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
