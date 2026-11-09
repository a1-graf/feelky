import { cn } from "@/lib/ui";

export function PageTitle({ title, subtitle, className }: { title: string; subtitle?: string; className?: string }) {
  return (
    <div className={cn("mb-5", className)}>
      <h1 className="text-[26px] font-bold leading-tight tracking-tight">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
