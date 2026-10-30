import { ForksStatistics } from "@/components/forks-statistics";
import { PageTitle } from "@/components/page-title";
import { getForksPage } from "@/lib/forks";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ForksPage({ searchParams }: { searchParams?: Promise<{ month?: string; period?: string }> }) {
  const userId = await requireUserId();
  const params = await searchParams;
  const { period, stats, allTime, series, hidden, bonus } = await getForksPage(userId, { month: params?.month, period: params?.period });

  return (
    <>
      <div className="hidden md:block">
        <PageTitle title="Вилки" subtitle={`Арбітражні вилки 1win ↔ Polymarket (Багіра) · ${period.label}`} />
      </div>
      <ForksStatistics stats={stats} allTime={allTime} series={series} bonus={bonus} period={period} hidden={hidden} />
    </>
  );
}
