import type { CSSProperties } from "react";
import { Card } from "@/components/ui/card";

type MetricItem = {
  label: string;
  value: string;
  subValue?: string;
  tone?: "ok" | "warn" | "danger";
  valueStyle?: CSSProperties;
  /** An emoji shown instead of the tone dot. */
  icon?: string;
};

export function MetricGrid({ items, desktopColumns = 4 }: { items: MetricItem[]; desktopColumns?: 3 | 4 }) {
  return (
    <div className={`grid grid-cols-2 gap-2.5 sm:gap-3 ${desktopColumns === 3 ? "xl:grid-cols-3" : "xl:grid-cols-4"}`}>
      {items.map((item) => (
        <Card key={item.label} className="min-h-24 p-3.5 transition-shadow duration-150 hover:shadow-soft sm:min-h-28 sm:p-4">
          <div className="flex items-center gap-2">
            {item.icon ? (
              <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-[13px] leading-none">{item.icon}</span>
            ) : (
              <span
                aria-hidden="true"
                className={`mt-1 h-2 w-2 shrink-0 rounded-full ${item.tone === "danger" ? "bg-danger" : item.tone === "warn" ? "bg-warning" : item.tone === "ok" ? "bg-success" : "bg-[hsl(var(--border))]"}`}
              />
            )}
            <div className={`text-[11px] font-medium leading-tight text-[hsl(var(--card-muted-foreground))] sm:text-[13px] ${item.icon ? "" : "min-h-8 sm:min-h-10"}`}>
              {item.label}
            </div>
          </div>
          <div
            className={`mt-2.5 break-words text-lg font-bold leading-tight tracking-tight sm:text-[22px] ${item.tone === "danger" ? "text-danger" : item.tone === "warn" ? "text-warning" : item.tone === "ok" ? "text-success" : ""}`}
            style={item.valueStyle}
          >
            {item.value}
          </div>
          <div className="mt-1 min-h-4 text-xs font-medium text-[hsl(var(--card-muted-foreground))] sm:min-h-5 sm:text-[13px]">
            {item.subValue || <span aria-hidden="true">&nbsp;</span>}
          </div>
        </Card>
      ))}
    </div>
  );
}
