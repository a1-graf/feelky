import type { CSSProperties } from "react";
import { Card } from "@/components/ui/card";

type MetricItem = {
  label: string;
  value: string;
  tone?: "ok" | "warn" | "danger";
  valueStyle?: CSSProperties;
};

export function MetricGrid({ items }: { items: MetricItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label} className="flex min-h-20 flex-col justify-between p-3 sm:min-h-28 sm:p-4">
          <div className="text-[11px] leading-tight text-[hsl(var(--card-muted-foreground))] sm:text-sm">{item.label}</div>
          <div
            className={`mt-2 break-words text-lg font-semibold leading-tight sm:text-2xl ${item.tone === "danger" ? "text-danger" : item.tone === "warn" ? "text-warning" : item.tone === "ok" ? "text-success" : ""}`}
            style={item.valueStyle}
          >
            {item.value}
          </div>
        </Card>
      ))}
    </div>
  );
}
