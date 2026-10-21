import { prisma } from "@/lib/db";
import { buildFxImportPlan, runFxImport, summarizeFxImportPlan } from "@/lib/fx-import";

// Usage: npm run import:fx -- user@example.com (--from "Мейн гаманець" | --external) [--dry-run]
async function main() {
  const args = process.argv.slice(2);
  const flag = (name: string) => args.includes(name);
  const option = (name: string) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const positional = args.filter((arg, index) => !arg.startsWith("--") && args[index - 1] !== "--from");
  const email = (positional[0] || process.env.SEED_EMAIL || "").toLowerCase();
  const from = option("--from");
  if (!email || (!from && !flag("--external"))) {
    throw new Error('Usage: npm run import:fx -- user@example.com (--from "ACCOUNT" | --external) [--dry-run]');
  }

  const plan = buildFxImportPlan();
  const summary = summarizeFxImportPlan(plan);
  console.log(
    `Plan: trades=${plan.trades.length} flows=${plan.flows.length} deposited=${summary.deposited} withdrawn=${summary.withdrawn} pnl=${summary.stats.totalPnl} R=${summary.stats.allTime.sumR} balance=${summary.balance}`
  );
  if (flag("--dry-run")) return;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("User not found");
  console.log(JSON.stringify(await runFxImport(user.id, { counterpartyName: from ?? null, plan }), null, 2));
}

main().finally(async () => prisma.$disconnect());
