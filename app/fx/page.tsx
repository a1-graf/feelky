import { FxStatistics } from "@/components/fx-statistics";
import { PageTitle } from "@/components/page-title";
import { getFxStatistics } from "@/lib/fx";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function FxPage() {
  const userId = await requireUserId();
  const { data, brokers, flows, hidden } = await getFxStatistics(userId);

  return (
    <>
      <PageTitle title="FX" subtitle="Форекс: усі позиції в R і $, місяці, весь час, баланс і депозити" />
      <FxStatistics data={data} brokers={brokers} flows={flows} hidden={hidden} />
    </>
  );
}
