import { PageTitle } from "@/components/page-title";
import { PeriodPicker } from "@/components/period-picker";
import { PolyStatistics } from "@/components/poly-statistics";
import { getPolyOverview } from "@/lib/poly";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function PolyPage({ searchParams }: { searchParams?: Promise<{ month?: string; period?: string }> }) {
  const userId = await requireUserId();
  const params = await searchParams;
  const overview = await getPolyOverview(userId, { month: params?.month, period: params?.period });

  return (
    <>
      <PageTitle title="Polymarket" subtitle="Вручну, копітрейд і три AI-агенти: кожна угода окремим рядком, PnL, ризики й блокування" />
      <PeriodPicker basePath="/poly" period={overview.period} presets={["week", "month", "3m", "6m", "12m", "all"]} />
      <PolyStatistics overview={overview} />
    </>
  );
}
