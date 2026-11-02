import { FlipsStatistics } from "@/components/flips-statistics";
import { PageTitle } from "@/components/page-title";
import { PeriodPicker } from "@/components/period-picker";
import { getFlipStatistics } from "@/lib/flips";
import { requireUserId } from "@/lib/session";

export default async function FlipsPage({ searchParams }: { searchParams?: Promise<{ month?: string; period?: string }> }) {
  const userId = await requireUserId();
  const params = await searchParams;
  const { data, hidden, period, allTimePnl } = await getFlipStatistics(userId, { month: params?.month, period: params?.period });

  return (
    <>
      <PageTitle title="Фліпи" subtitle={`Закриті спекуляції, результат і сетапи · ${period.label}`} />
      <PeriodPicker basePath="/flips" period={period} presets={["week", "month", "3m", "6m", "12m", "all"]} />
      <FlipsStatistics data={data} allTimePnl={allTimePnl} periodLabel={period.label} hidden={hidden} />
    </>
  );
}
