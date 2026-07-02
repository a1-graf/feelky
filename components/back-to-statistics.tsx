import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function BackToStatistics() {
  return (
    <Link href="/statistics" className="mb-4 inline-flex min-h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium text-[hsl(var(--card-foreground))] shadow-soft hover:bg-muted">
      <ArrowLeft className="h-4 w-4" />
      Назад до статистики
    </Link>
  );
}
