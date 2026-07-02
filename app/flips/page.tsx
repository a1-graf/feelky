import { AppShell } from "@/components/layout/app-shell";
import { FlipsStatistics } from "@/components/flips-statistics";
import { PageTitle } from "@/components/page-title";
import { getDashboard } from "@/lib/dashboard";
import { requireUserId } from "@/lib/session";

export default async function FlipsPage() {
  const userId = await requireUserId();
  const data = await getDashboard(userId);
  const hidden = Boolean(data.settings?.hideAmounts);

  return (
    <AppShell>
      <PageTitle title="Фліпи" subtitle="Стата по сетапах, плюсових і мінусових спекуляціях" />
      <FlipsStatistics data={data.flips} hidden={hidden} />
    </AppShell>
  );
}
