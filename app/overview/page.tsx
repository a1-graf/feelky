import { FeelkyHome } from "@/components/home/gpt-home";
import { getDashboard } from "@/lib/dashboard";
import { getExpensesPage } from "@/lib/expenses";
import { requireUserId } from "@/lib/session";

export default async function OverviewPage({ searchParams }: { searchParams?: Promise<{ month?: string; period?: string }> }) {
  const userId = await requireUserId();
  const params = await searchParams;
  const [data, expenses] = await Promise.all([
    getDashboard(userId, { month: params?.month, period: params?.period }),
    getExpensesPage(userId, { period: "month" })
  ]);
  return <FeelkyHome data={data} expenses={expenses} />;
}
