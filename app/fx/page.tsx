import { DayPnl, TitleWithDayPnl } from "@/components/day-pnl";
import { FxStatistics } from "@/components/fx-statistics";
import { PageTitle } from "@/components/page-title";
import { lastDaysPnl } from "@/lib/day-pnl";
import { getFxStatistics } from "@/lib/fx";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function FxPage() {
  const userId = await requireUserId();
  const { data, brokers, flows, balanceSeries, hidden } = await getFxStatistics(userId);

  const dayPnl = lastDaysPnl(data.timeline.map((point) => ({ date: point.date, pnl: point.profit - point.loss })));

  return (
    <>
      <TitleWithDayPnl
        title={
          <div className="hidden md:block">
            <PageTitle className="mb-0" title="Форекс" subtitle="Форекс: усі позиції в R і $, місяці, весь час, баланс і депозити" />
          </div>
        }
      >
        <DayPnl days={dayPnl} currency={brokers[0]?.currency || "USD"} hidden={hidden} />
      </TitleWithDayPnl>
      <FxStatistics data={data} brokers={brokers} flows={flows} balanceSeries={balanceSeries} hidden={hidden} />
    </>
  );
}
