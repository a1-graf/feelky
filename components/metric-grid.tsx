import type { CSSProperties } from "react";
import { Card } from "@/components/ui/card";

type MetricItem = {
  label: string;
  value: string;
  subValue?: string;
  tone?: "ok" | "warn" | "danger";
  valueStyle?: CSSProperties;
};

export function MetricGrid({ items, desktopColumns = 4 }: { items: MetricItem[]; desktopColumns?: 3 | 4 }) {
  return (
    <div className={`grid grid-cols-2 gap-2.5 sm:gap-3 ${desktopColumns === 3 ? "xl:grid-cols-3" : "xl:grid-cols-4"}`}>
      {items.map((item) => (
        <Card key={item.label} className="min-h-28 p-3.5 transition-shadow duration-150 hover:shadow-soft sm:min-h-32 sm:p-4">
          <div className="flex items-start gap-2">
            <span
              aria-hidden="true"
              className={`mt-1 h-2 w-2 shrink-0 rounded-full ${item.tone === "danger" ? "bg-danger" : item.tone === "warn" ? "bg-warning" : item.tone === "ok" ? "bg-success" : "bg-[hsl(var(--border))]"}`}
            />
            <div className="min-h-8 text-[11px] font-medium leading-tight text-[hsl(var(--card-muted-foreground))] sm:min-h-10 sm:text-[13px]">
              {item.label}
            </div>
          </div>
          <div
            className={`mt-1 break-words text-lg font-bold leading-tight tracking-tight sm:text-[22px] ${item.tone === "danger" ? "text-danger" : item.tone === "warn" ? "text-warning" : item.tone === "ok" ? "text-success" : ""}`}
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
