import { PageTitle } from "@/components/page-title";
import { Card } from "@/components/ui/card";
import { TradeJournal } from "@/components/poly-variants/trade-journal";
import { PolyVariantNav } from "@/components/poly-variants/variant-nav";
import { getPolyVariantsData, polyTradeSource } from "@/lib/poly-variants";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Variant 3: a journal of trades with filters and wins set against losses. */
export default async function PolyV3Page() {
  const userId = await requireUserId();
  const { overview } = await getPolyVariantsData(userId);
  const trades = overview.trades.map((trade) => ({
    id: trade.id,
    source: polyTradeSource(trade),
    walletRef: trade.walletRef,
    marketKind: trade.marketKind,
    title: trade.title,
    outcome: trade.outcome,
    entryPrice: trade.entryPrice,
    sizeUsd: trade.sizeUsd,
    feesUsd: trade.feesUsd,
    status: trade.status,
    pnlUsd: trade.pnlUsd,
    openedAt: trade.openedAt,
    resolvedAt: trade.resolvedAt,
    note: trade.note
  }));

  return (
    <>
      <PageTitle title="Polymarket" subtitle="Варіант 3 · журнал угод: фільтри, виграші проти програшів, кожна угода по днях" />
      <PolyVariantNav current="/poly/v3" />
      <Card>
        <TradeJournal trades={trades} hidden={overview.hidden} />
      </Card>
    </>
  );
}
