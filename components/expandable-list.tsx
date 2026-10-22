"use client";

import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";

/** Collapsed to one preview row; expanded shows a scrollable box (about five rows tall). Content is rendered by the server page. */
export function ExpandableList({ preview, full, count, title }: { preview: ReactNode; full: ReactNode; count: number; title: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="mb-2 flex w-full items-center justify-between gap-2 text-left">
        <span className="font-semibold">{title}</span>
        <span className="flex items-center gap-2">
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-semibold tabular-nums text-[hsl(var(--card-muted-foreground))]">{count}</span>
          <ChevronDown className={`h-4 w-4 text-[hsl(var(--card-muted-foreground))] transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      {open ? <div className="max-h-[22rem] overflow-y-auto rounded-lg">{full}</div> : preview}
    </div>
  );
}
