import { cn } from "@/lib/ui";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/60 bg-card/80 p-4 text-[hsl(var(--card-foreground))] shadow-card backdrop-blur-sm",
        className
      )}
      {...props}
    />
  );
}
