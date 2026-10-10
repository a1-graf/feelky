import { redirect } from "next/navigation";

/** Statistics now live on the overview page; old links and bookmarks land there. */
export default async function StatisticsPage({ searchParams }: { searchParams?: Promise<{ month?: string }> }) {
  const params = await searchParams;
  const month = params?.month && /^\d{4}-\d{2}$/.test(params.month) ? params.month : null;
  redirect(month ? `/overview?month=${month}` : "/overview");
}
