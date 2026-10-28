"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { formatMoney, formatPercent, formatPlain, formatSigned } from "@/lib/money";
import type { ForkItem } from "@/lib/forks-stats";

const PREVIEW = 5;
const tone = (value: string) => (Number(value) > 0 ? "text-success" : Number(value) < 0 ? "text-danger" : "");
const formatDate = (iso: string) => new Date(iso).toLocaleString("uk-UA", { timeZone: "Europe/Kyiv", dateStyle: "short", timeStyle: "short" });
const pill = "min-h-11 rounded-full border border-border bg-card px-5 text-sm font-medium shadow-soft transition-colors hover:bg-muted";

function Leg({ leg, hidden }: { leg: ForkItem["legs"][number]; hidden: boolean }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-2">
      <span className="min-w-0 truncate">
        <span className="font-medium">{leg.book}</span> <span className="text-[hsl(var(--card-muted-foreground))]">{leg.pick}</span>
      </span>
      <span className="shrink-0 tabular-nums text-[hsl(var(--card-muted-foreground))]">
        @{formatPlain(leg.odds)} · {formatMoney(leg.stake, "USD", hidden)}
      </span>
    </div>
  );
}

function ForkRow({ fork, hidden }: { fork: ForkItem; hidden: boolean }) {
  const open = fork.status === "OPEN";
  return (
    <div className="rounded-lg bg-muted p-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-semibold">{fork.match}</div>
          <div className="text-xs text-[hsl(var(--card-muted-foreground))]">
            {formatDate(fork.placedAt)}
            {fork.sport ? ` · ${fork.sport}` : ""}
            {fork.tags.length ? ` · ${fork.tags.join(" · ")}` : ""}
          </div>
        </div>
        <div className="shrink-0 text-right">
          {open ? (
            <>
              <div className="font-semibold tabular-nums">{fork.guaranteed == null ? "—" : `гарант ${formatSigned(fork.guaranteed, hidden)}`}</div>
              <div className="text-xs text-[hsl(var(--card-muted-foreground))]">на кону {formatMoney(fork.total, "USD", hidden)}</div>
            </>
          ) : (
            <>
              <div className={`font-semibold tabular-nums ${fork.pnl == null ? "" : tone(fork.pnl)}`}>{fork.pnl == null ? "—" : `${formatSigned(fork.pnl, hidden)} USD`}</div>
              <div className="text-xs text-[hsl(var(--card-muted-foreground))]">{fork.percent == null ? "—" : formatPercent(fork.percent, hidden)} · {formatMoney(fork.total, "USD", hidden)}</div>
            </>
          )}
        </div>
      </div>
      <div className="mt-2 grid gap-0.5 border-t border-border/60 pt-2 text-xs">
        {fork.legs.map((leg) => (
          <Leg key={leg.book + leg.pick} leg={leg} hidden={hidden} />
        ))}
      </div>
    </div>
  );
}

export function ForksOpen({ items, stake, guaranteed, hidden = false }: { items: ForkItem[]; stake: string; guaranteed: string; hidden?: boolean }) {
  return (
    <Card className="mt-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div className="font-semibold">У грі</div>
        <div className="text-xs text-[hsl(var(--card-muted-foreground))]">
          {items.length ? `${items.length} · ${formatMoney(stake, "USD", hidden)} · гарант ${formatSigned(guaranteed, hidden)}` : ""}
        </div>
      </div>
      {items.length ? (
        <div className="grid gap-2">
          {items.map((fork) => (
            <ForkRow key={fork.id} fork={fork} hidden={hidden} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-[hsl(var(--card-muted-foreground))]">Відкритих вилок немає.</div>
      )}
    </Card>
  );
}

export function ForksClosed({ items, hidden = false }: { items: ForkItem[]; hidden?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, PREVIEW);
  const rest = items.length - PREVIEW;
  return (
    <Card className="mt-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div className="font-semibold">Закриті вилки</div>
        {items.length ? <div className="text-xs text-[hsl(var(--card-muted-foreground))]">{expanded ? `усі ${items.length}` : `${visible.length} з ${items.length}`}</div> : null}
      </div>
      {items.length ? (
        <>
          <div className="grid gap-2">
            {visible.map((fork) => (
              <ForkRow key={fork.id} fork={fork} hidden={hidden} />
            ))}
          </div>
          {rest > 0 && (
            <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-10 mt-3 flex justify-center md:bottom-4">
              <button type="button" onClick={() => setExpanded((value) => !value)} className={pill} aria-expanded={expanded}>
                {expanded ? "Згорнути" : `Показати ще (${rest})`}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-[hsl(var(--card-muted-foreground))]">За цей період закритих вилок немає.</div>
      )}
    </Card>
  );
}
