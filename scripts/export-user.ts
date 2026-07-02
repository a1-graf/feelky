import { writeFileSync, mkdirSync } from "node:fs";
import { prisma } from "@/lib/db";

async function main() {
  const email = process.argv[2] || process.env.SEED_EMAIL;
  if (!email) throw new Error("Usage: npm run export:user -- user@example.com");
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) throw new Error("User not found");
  const data = {
    exportedAt: new Date().toISOString(),
    user: { id: user.id, email: user.email, name: user.name },
    accounts: await prisma.account.findMany({ where: { userId: user.id } }),
    categories: await prisma.category.findMany({ where: { userId: user.id } }),
    incomeSources: await prisma.incomeSource.findMany({ where: { userId: user.id } }),
    transactions: await prisma.transaction.findMany({ where: { userId: user.id } }),
    frozenFunds: await prisma.frozenFund.findMany({ where: { userId: user.id } }),
    expectedMoney: await prisma.expectedMoney.findMany({ where: { userId: user.id } }),
    settings: await prisma.settings.findUnique({ where: { userId: user.id } })
  };
  mkdirSync("backups", { recursive: true });
  const path = `backups/user-${user.email}-${Date.now()}.json`;
  writeFileSync(path, JSON.stringify(data, null, 2));
  console.log(path);
}

main().finally(async () => prisma.$disconnect());
