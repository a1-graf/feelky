import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function BackToOverview() {
  return (
    <Link href="/overview" className="mb-4 hidden min-h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium text-[hsl(var(--card-foreground))] shadow-soft hover:bg-muted md:inline-flex">
      <ArrowLeft className="h-4 w-4" />
      Назад на головну
    </Link>
  );
}
