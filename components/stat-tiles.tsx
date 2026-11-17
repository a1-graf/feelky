import { cn } from "@/lib/ui";

/** Muted tile with a small label in the corner and one big centered figure (the balance tile on /fx and /poly). */
export function BigTile({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("relative flex items-center justify-center rounded-lg bg-muted px-3 py-3.5 text-center", className)}>
      <div className="absolute left-3 top-2 text-xs text-[hsl(var(--card-muted-foreground))]">{label}</div>
      <div className="font-bold tabular-nums text-2xl sm:text-4xl xl:text-5xl">{children}</div>
    </div>
  );
}

/** Two (or `className="lg:grid-cols-3"` for three) figures side by side on desktop, stacked under each other on a phone; `Half edge` lays out four as a column / 2x2. */
export function SplitTile({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-1 items-center rounded-lg bg-muted py-3.5 lg:grid-cols-2", className)}>{children}</div>;
}

/**
 * `edge` replaces the stock divider classes when a cell needs its own borders (the 2x2 split).
 * `compact` is for a quarter of a half-width tile (~78px on a phone): smaller type, and a figure may break at its space ("-31,82 / USD").
 */
export function Half({ label, main, sub, className = "", divider = false, edge, compact = false }: { label: string; main: React.ReactNode; sub?: string; className?: string; divider?: boolean; edge?: string; compact?: boolean }) {
  return (
    <div className={`flex min-w-0 flex-col justify-center text-center ${compact ? "px-1 sm:px-2" : "px-2"} ${edge ?? (divider ? "mt-3 border-t-2 border-foreground/70 pt-3 lg:mt-0 lg:self-stretch lg:border-l-2 lg:border-t-0 lg:pt-0" : "lg:pb-0")}`}>
      <div className={compact ? "text-[11px] leading-tight text-[hsl(var(--card-muted-foreground))] sm:text-sm" : "text-sm text-[hsl(var(--card-muted-foreground))]"}>{label}</div>
      <div className={`font-bold tabular-nums ${compact ? "mt-1 sm:whitespace-nowrap" : "mt-1.5 whitespace-nowrap"} ${className}`}>
        <div className={compact ? "text-[15px] leading-tight sm:text-xl xl:text-2xl" : "text-xl sm:text-2xl xl:text-3xl"}>{main}</div>
        {sub && <div className="mt-0.5 text-lg">{sub}</div>}
      </div>
    </div>
  );
}
