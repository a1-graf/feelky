import { BackToStatistics } from "@/components/back-to-statistics";
import { AppShell } from "@/components/layout/app-shell";
import { MetricGrid } from "@/components/metric-grid";
import { PageTitle } from "@/components/page-title";
import { Card } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { formatMoney, sumDecimals } from "@/lib/money";
import { requireUserId } from "@/lib/session";

export default async function ExpectedPage() {
  const userId = await requireUserId();
  const items = await prisma.expectedMoney.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  const active = items.filter((item) => ["EXPECTED", "NEED_TO_COLLECT", "IN_PROGRESS"].includes(item.status));
  return (
    <AppShell>
      <BackToStatistics />
      <PageTitle title="Заморожені бабки" subtitle="Назва допомагає тримати в голові, де лежать гроші і що треба забрати" />
      <MetricGrid items={[{ label: "Заморожено UAH", value: formatMoney(sumDecimals(active.filter((i) => i.currency === "UAH").map((i) => i.amount)), "UAH") }, { label: "Заморожено USDT", value: formatMoney(sumDecimals(active.filter((i) => i.currency === "USDT").map((i) => i.amount)), "USDT") }, { label: "Записів", value: String(items.length) }]} />
      <div className="mt-5 grid gap-3">
        {items.map((item) => <Card key={item.id}><div className="flex justify-between gap-3"><div><div className="font-medium">{item.title}</div><div className="text-sm text-muted-foreground">{item.status}{item.note ? ` · ${item.note}` : ""}</div></div><div className="font-semibold">{formatMoney(item.amount, item.currency)}</div></div></Card>)}
      </div>
    </AppShell>
  );
}
