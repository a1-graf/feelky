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

/** Two figures side by side on desktop, stacked under each other on a phone. */
export function SplitTile({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 items-center rounded-lg bg-muted py-3.5 lg:grid-cols-2">{children}</div>;
}

export function Half({ label, main, sub, className = "", divider = false }: { label: string; main: React.ReactNode; sub?: string; className?: string; divider?: boolean }) {
  return (
    <div className={`flex min-w-0 flex-col justify-center px-2 text-center ${divider ? "mt-3 border-t-2 border-foreground/70 pt-3 lg:mt-0 lg:self-stretch lg:border-l-2 lg:border-t-0 lg:pt-0" : "lg:pb-0"}`}>
      <div className="text-sm text-[hsl(var(--card-muted-foreground))]">{label}</div>
      <div className={`mt-1.5 whitespace-nowrap font-bold tabular-nums ${className}`}>
        <div className="text-xl sm:text-2xl xl:text-3xl">{main}</div>
        {sub && <div className="mt-0.5 text-lg">{sub}</div>}
      </div>
    </div>
  );
}
