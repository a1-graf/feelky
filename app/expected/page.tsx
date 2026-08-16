import { BackToStatistics } from "@/components/back-to-statistics";
import { ExpectedMoneyList } from "@/components/expected-money-list";
import { MetricGrid } from "@/components/metric-grid";
import { PageTitle } from "@/components/page-title";
import { prisma } from "@/lib/db";
import { formatMoney, sumDecimals } from "@/lib/money";
import { requireUserId } from "@/lib/session";

export default async function ExpectedPage() {
  const userId = await requireUserId();
  const items = await prisma.expectedMoney.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  const active = items.filter((item) => ["EXPECTED", "NEED_TO_COLLECT", "IN_PROGRESS"].includes(item.status));
  return (
    <>
      <BackToStatistics />
      <PageTitle title="Заморожені бабки" subtitle="Назва допомагає тримати в голові, де лежать гроші і що треба забрати" />
      <MetricGrid items={[{ label: "Заморожено UAH", value: formatMoney(sumDecimals(active.filter((i) => i.currency === "UAH").map((i) => i.amount)), "UAH") }, { label: "Заморожено USDT", value: formatMoney(sumDecimals(active.filter((i) => i.currency === "USDT").map((i) => i.amount)), "USDT") }, { label: "Записів", value: String(items.length) }]} />
      <div className="mt-5">
        <ExpectedMoneyList items={items.map((item) => ({
          id: item.id,
          title: item.title,
          amount: item.amount.toString(),
          currency: item.currency,
          status: item.status,
          note: item.note
        }))} />
      </div>
    </>
  );
}
