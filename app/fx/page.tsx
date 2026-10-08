import { FxStatistics } from "@/components/fx-statistics";
import { PageTitle } from "@/components/page-title";
import { getFxStatistics } from "@/lib/fx";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function FxPage() {
  const userId = await requireUserId();
  const { data, brokers, hidden } = await getFxStatistics(userId);

  return (
    <>
      <PageTitle title="FX" subtitle="Форекс-угоди, які заносить агент: PnL, winrate, інструменти й сетапи" />
      <FxStatistics data={data} brokers={brokers} hidden={hidden} />
    </>
  );
}
