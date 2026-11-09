import type { DayPnlPoint } from "@/lib/day-pnl";
import { D, formatSigned } from "@/lib/money";
import { cn } from "@/lib/ui";

const tone = (value: number) => (value > 0 ? "text-success" : value < 0 ? "text-danger" : "text-[hsl(var(--card-muted-foreground))]");
const dayLabel = (date: string) => `${date.slice(8, 10)}.${date.slice(5, 7)}`;

/** Compact per-day result of a sphere: last days as diverging mini bars with the day's sum under each. */
export function DayPnl({ days, currency, hidden = false, className }: { days: DayPnlPoint[]; currency: string; hidden?: boolean; className?: string }) {
  const values = days.map((day) => Number(day.pnl));
  const max = Math.max(...values.map(Math.abs), 0);
  const total = days.reduce((sum, day) => sum.plus(day.pnl), D(0));
  const today = days.at(-1)?.date;

  return (
    <section
      aria-label="PnL по днях"
      className={cn("rounded-2xl border border-border/60 bg-card/80 px-3 py-2.5 text-[hsl(var(--card-foreground))] shadow-card md:w-[360px] md:shrink-0", className)}
    >
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-medium text-[hsl(var(--card-muted-foreground))]">PnL по днях</span>
        <span className={cn("font-semibold tabular-nums", tone(total.toNumber()))}>
          {days.length} дн. {formatSigned(total, hidden)} {currency}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1">
        {days.map((day, index) => {
          const value = values[index];
          const height = max > 0 ? Math.max(Math.round((Math.abs(value) / max) * 100), value === 0 ? 0 : 6) : 0;
          return (
            <div key={day.date} className="flex min-w-0 flex-col items-center" title={`${dayLabel(day.date)}: ${formatSigned(day.pnl, hidden)} ${currency}`}>
              <div className="relative h-9 w-full max-w-6" aria-hidden="true">
                <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
                {height > 0 ? (
                  <div
                    className={cn("absolute inset-x-1 rounded-[3px]", value > 0 ? "bottom-1/2 bg-success" : "top-1/2 bg-danger")}
                    style={{ height: `${height / 2}%` }}
                  />
                ) : null}
              </div>
              <div className={cn("mt-1 w-full truncate text-center text-[10px] font-semibold leading-tight tracking-tight tabular-nums", tone(value))}>
                {value === 0 ? "—" : formatSigned(day.pnl, hidden)}
              </div>
              <div className={cn("text-[10px] leading-tight text-[hsl(var(--card-muted-foreground))]", day.date === today && "font-semibold text-[hsl(var(--card-foreground))]")}>
                {dayLabel(day.date)}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Page title with the day-PnL block on its right (stacked under the title on mobile). */
export function TitleWithDayPnl({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      {title}
      {children}
    </div>
  );
}
