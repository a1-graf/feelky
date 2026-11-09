import { DayPnl, TitleWithDayPnl } from "@/components/day-pnl";
import { PageTitle } from "@/components/page-title";
import { PeriodPicker } from "@/components/period-picker";
import { PolyStatistics } from "@/components/poly-statistics";
import { PolyVariantNav } from "@/components/poly-variants/variant-nav";
import { lastDaysPnl } from "@/lib/day-pnl";
import { getPolyOverview } from "@/lib/poly";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function PolyPage({ searchParams }: { searchParams?: Promise<{ month?: string; period?: string }> }) {
  const userId = await requireUserId();
  const params = await searchParams;
  const overview = await getPolyOverview(userId, { month: params?.month, period: params?.period });

  const dayPnl = lastDaysPnl(overview.all.timeline.map((point) => ({ date: point.date, pnl: point.pnl })));

  return (
    <>
      <TitleWithDayPnl
        title={<PageTitle className="mb-0" title="Polymarket" subtitle="Вручну, копітрейд і три AI-агенти: кожна угода окремим рядком, PnL, ризики й блокування" />}
      >
        <DayPnl days={dayPnl} currency="USDT" hidden={overview.hidden} />
      </TitleWithDayPnl>
      <PeriodPicker basePath="/poly" period={overview.period} presets={["week", "month", "3m", "6m", "12m", "all"]} />
      <PolyVariantNav current="/poly" />
      <PolyStatistics overview={overview} />
    </>
  );
}
