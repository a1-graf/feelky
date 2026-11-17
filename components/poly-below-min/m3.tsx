"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/ui";
import type { BelowData } from "../poly-below-variants/data";
import { ReconcileAlert } from "../poly-below-variants/shared";
import { BarRows, CUTS, DIV, HAIR, KV, Label, LockStatus, minorStats, money, muted, PoolHero, Slippage } from "./kit";

/** Minimal 3 — one block: the pool with a thin locked-share bar, plain rows, then 2px bars for where it earns and loses. */
export function BelowM3({ data }: { data: BelowData }) {
  const { hidden } = data;
  const sources = data.sources.map((source) => ({ ...source.all, label: source.label }));
  const locked = data.agents.some((agent) => agent.lock);
  return (
    <Card data-below="m3" className="mt-4 px-5 py-5">
      <ReconcileAlert data={data} className="mb-3" />
      <PoolHero data={data} bar note={!locked} />
      {locked ? (
        <div className={cn("mt-1 text-xs", muted)}>
          {money(data.metrics.lockedPrincipal, hidden)} заблоковано · <LockStatus data={data} />
        </div>
      ) : null}
      <div className={cn("mt-4 divide-y border-y", HAIR, DIV)}>
        {minorStats(data).map((item) => (
          <KV key={item.key} label={item.label} value={item.value} valueClass={item.cls} />
        ))}
        <Slippage data={data} />
      </div>

      <div className="mt-6 text-sm font-medium">Де заробляє і де втрачає</div>
      <Label className="mb-1.5 mt-3">Джерела</Label>
      <BarRows rows={sources} hidden={hidden} />
      {CUTS.map(({ key, label }) => (
        <div key={key}>
          <Label className="mb-1.5 mt-4">{label}</Label>
          <BarRows rows={data.breakdowns[key]} hidden={hidden} />
        </div>
      ))}
      <div className={cn("mt-4 text-[11px]", muted)}>Число біля назви — кількість угод</div>
    </Card>
  );
}
