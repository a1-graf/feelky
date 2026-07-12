import { AppShell } from "@/components/layout/app-shell";
import { FlipsStatistics } from "@/components/flips-statistics";
import { PageTitle } from "@/components/page-title";
import { getFlipStatistics } from "@/lib/flips";
import { requireUserId } from "@/lib/session";

export default async function FlipsPage() {
  const userId = await requireUserId();
  const { data, hidden } = await getFlipStatistics(userId);

  return (
    <AppShell>
      <PageTitle title="Фліпи" subtitle="Стата по сетапах, плюсових і мінусових спекуляціях" />
      <FlipsStatistics data={data} hidden={hidden} />
    </AppShell>
  );
}
