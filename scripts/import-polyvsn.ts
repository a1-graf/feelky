import { prisma } from "@/lib/db";
import { buildPolyvsnPlan, runPolyvsnImport, summarizePolyvsnPlan } from "@/lib/polyvsn-import";

// Usage: npm run import:polyvsn -- user@example.com [--account "Мейн гаманець"] [--allow-overdraft] [--dry-run]
async function main() {
  const args = process.argv.slice(2);
  const flag = (name: string) => args.includes(name);
  const option = (name: string) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const positional = args.filter((arg, index) => !arg.startsWith("--") && args[index - 1] !== "--account");
  const email = (positional[0] || process.env.SEED_EMAIL || "").toLowerCase();
  if (!email) throw new Error("Usage: npm run import:polyvsn -- user@example.com [--account NAME] [--allow-overdraft] [--dry-run]");
  const accountName = option("--account") || "Мейн гаманець";

  const plan = buildPolyvsnPlan();
  console.log("Plan totals:", summarizePolyvsnPlan(plan), `trades=${plan.trades.length} flows=${plan.flows.length}`);
  if (flag("--dry-run")) return;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("User not found");
  const result = await runPolyvsnImport(user.id, { accountName, allowOverdraft: flag("--allow-overdraft"), plan });
  console.log(JSON.stringify(result, null, 2));
}

main().finally(async () => prisma.$disconnect());
