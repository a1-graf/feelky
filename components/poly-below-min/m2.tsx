"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import type { BelowData } from "../poly-below-variants/data";
import type { BreakdownKey } from "../poly-below-variants/labels";
import { ReconcileAlert } from "../poly-below-variants/shared";
import { CUTS, HAIR, Label, Minor, muted, PoolHero, Rows, Slippage, Sources, TextTabs, Trades } from "./kit";

type Tab = "overview" | "cuts" | "trades";

/** Minimal 2 — text tabs with an underline; one screen at a time, no boxes inside. */
export function BelowM2({ data }: { data: BelowData }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [cut, setCut] = useState<BreakdownKey>("market");
  return (
    <Card data-below="m2" className="mt-4 px-5 py-5">
      <ReconcileAlert data={data} className="mb-3" />
      <TextTabs
        value={tab}
        onChange={setTab}
        items={[
          { key: "overview", label: "Огляд" },
          { key: "cuts", label: "Розрізи" },
          { key: "trades", label: <>Угоди <span className={muted}>{data.trades.length}</span></> },
        ]}
      />
      {tab === "overview" ? (
        <div className="pt-5">
          <PoolHero data={data} />
          <Minor data={data} className="mt-5" />
          <Label className="mt-6">Джерела угод</Label>
          <Sources data={data} />
          <Slippage data={data} className={`border-t ${HAIR}`} />
        </div>
      ) : null}
      {tab === "cuts" ? (
        <div className="pt-4">
          <TextTabs small value={cut} onChange={setCut} items={CUTS} />
          <Rows rows={data.breakdowns[cut]} hidden={data.hidden} />
        </div>
      ) : null}
      {tab === "trades" ? (
        <div className="pt-1">
          <Trades data={data} />
        </div>
      ) : null}
    </Card>
  );
}
