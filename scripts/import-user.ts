import { readFileSync } from "node:fs";
import { z } from "zod";

const backupSchema = z.object({
  exportedAt: z.string(),
  user: z.object({ email: z.string().email() }),
  accounts: z.array(z.object({ userId: z.string() })),
  categories: z.array(z.object({ userId: z.string() })),
  incomeSources: z.array(z.object({ userId: z.string() })),
  transactions: z.array(z.object({ userId: z.string() })),
  frozenFunds: z.array(z.object({ userId: z.string() })),
  expectedMoney: z.array(z.object({ userId: z.string() }))
});

const file = process.argv[2];
if (!file) {
  throw new Error("Usage: npm run import:user -- backups/user.json");
}

const parsed = backupSchema.parse(JSON.parse(readFileSync(file, "utf8")));
const allUserIds = [
  ...parsed.accounts,
  ...parsed.categories,
  ...parsed.incomeSources,
  ...parsed.transactions,
  ...parsed.frozenFunds,
  ...parsed.expectedMoney
].map((item) => item.userId);
const uniqueUserIds = new Set(allUserIds);
if (uniqueUserIds.size > 1) {
  throw new Error("Backup contains mixed user data and was rejected");
}

console.log("Backup validation passed. Destructive import is intentionally not automatic in MVP.");
