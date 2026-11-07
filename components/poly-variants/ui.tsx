export const muted = "text-[hsl(var(--card-muted-foreground))]";
export const tone = (value: string | number) => (Number(value) > 0 ? "text-success" : Number(value) < 0 ? "text-danger" : "");
export const CUR = "USDT";

export function kyivDate(iso: string, withTime = false) {
  return new Date(iso).toLocaleString("uk-UA", { timeZone: "Europe/Kyiv", dateStyle: "short", ...(withTime ? { timeStyle: "short" as const } : {}) });
}

export function Metric({ label, value, hint, className = "" }: { label: string; value: React.ReactNode; hint?: React.ReactNode; className?: string }) {
  return (
    <div className="rounded-lg bg-muted p-3">
      <div className={`text-xs ${muted}`}>{label}</div>
      <div className={`mt-1 font-semibold tabular-nums ${className}`}>{value}</div>
      {hint ? <div className={`mt-0.5 text-xs ${muted}`}>{hint}</div> : null}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className={`rounded-lg border border-dashed border-border p-4 text-center text-sm ${muted}`}>{children}</div>;
}

/** Ukrainian plural for counts: 1 угода, 2 угоди, 5 угод. */
export function plural(count: number, one: string, few: string, many: string) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
