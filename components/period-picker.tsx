import Link from "next/link";
import { MONTH_SHORT, PERIOD_PRESETS, type PeriodKey } from "@/lib/period";

type Props = {
  basePath: string;
  period: { key: string; month: string | null };
  presets: readonly PeriodKey[];
  /** Year shown in the month chips; defaults to the selected month's year, else the current one. */
  year?: number;
};

const pill = "rounded-md px-2 py-1 text-xs font-semibold leading-4 transition-colors";
const pillOn = "bg-foreground text-background";
const pillOff = "bg-muted text-[hsl(var(--card-muted-foreground))] hover:text-foreground";

/** Preset pills + small month chips; plain links, so the period lives in the URL. */
export function PeriodPicker({ basePath, period, presets, year }: Props) {
  const now = new Date();
  const shownYear = year ?? (period.month ? Number(period.month.slice(0, 4)) : now.getFullYear());
  const items = PERIOD_PRESETS.filter((item) => presets.includes(item.key));

  return (
    <div className="rounded-xl border border-border/60 bg-card/80 p-2.5 shadow-card">
      <div className="flex flex-wrap gap-1">
        {items.map((item) => (
          <Link
            key={item.key}
            href={item.key === "month" ? basePath : `${basePath}?period=${item.key}`}
            className={`${pill} ${period.key === item.key ? pillOn : pillOff}`}
          >
            {item.label}
          </Link>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-0.5">
        <Link href={`${basePath}?month=${shownYear - 1}-12`} aria-label="Попередній рік" className="px-1 text-xs text-[hsl(var(--card-muted-foreground))] hover:text-foreground">‹</Link>
        <span className="px-1 text-[11px] font-semibold text-[hsl(var(--card-muted-foreground))]">{shownYear}</span>
        {shownYear < now.getFullYear() && (
          <Link href={`${basePath}?month=${shownYear + 1}-01`} aria-label="Наступний рік" className="px-1 text-xs text-[hsl(var(--card-muted-foreground))] hover:text-foreground">›</Link>
        )}
        {MONTH_SHORT.map((name, index) => {
          const value = `${shownYear}-${String(index + 1).padStart(2, "0")}`;
          const future = shownYear > now.getFullYear() || (shownYear === now.getFullYear() && index > now.getMonth());
          const active = period.key === "custom" && period.month === value;
          if (future) return <span key={value} className="px-1.5 py-0.5 text-[11px] text-[hsl(var(--card-muted-foreground))] opacity-40">{name}</span>;
          return (
            <Link key={value} href={`${basePath}?month=${value}`} className={`rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors ${active ? pillOn : "text-[hsl(var(--card-muted-foreground))] hover:text-foreground"}`}>
              {name}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
