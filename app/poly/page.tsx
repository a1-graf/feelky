import { PageTitle } from "@/components/page-title";
import { PolyStatistics } from "@/components/poly-statistics";
import { getPolyOverview } from "@/lib/poly";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function PolyPage() {
  const userId = await requireUserId();
  const overview = await getPolyOverview(userId);

  return (
    <>
      <PageTitle title="Polymarket" subtitle="Вручну, копітрейд і три AI-агенти: кожна угода окремим рядком, PnL, ризики й блокування" />
      <PolyStatistics overview={overview} />
    </>
  );
}
