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
        <Card key={item.label} className="min-h-28 p-3 sm:min-h-32 sm:p-4">
          <div className="min-h-8 text-[11px] leading-tight text-[hsl(var(--card-muted-foreground))] sm:min-h-10 sm:text-sm">{item.label}</div>
          <div
            className={`break-words text-lg font-semibold leading-tight sm:text-2xl ${item.tone === "danger" ? "text-danger" : item.tone === "warn" ? "text-warning" : item.tone === "ok" ? "text-success" : ""}`}
            style={item.valueStyle}
          >
            {item.value}
          </div>
          <div className="mt-1 min-h-4 text-xs font-medium text-[hsl(var(--card-muted-foreground))] sm:min-h-5 sm:text-sm">
            {item.subValue || <span aria-hidden="true">&nbsp;</span>}
          </div>
        </Card>
      ))}
    </div>
  );
}
