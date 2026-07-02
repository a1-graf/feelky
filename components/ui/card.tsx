import { cn } from "@/lib/ui";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-lg border border-border bg-card p-4 text-[hsl(var(--card-foreground))] shadow-soft", className)} {...props} />;
}
