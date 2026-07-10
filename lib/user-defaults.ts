import { AccountType, ExpectedMoneyStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

export const MAIN_WALLET_NAME = "Мейн гаманець";
export const SAVINGS_ACCOUNT_NAME = "Відкладення";

const categories = ["Їжа", "Ресторани", "Здоров'я", "Техніка", "Розваги", "Підписки", "Перекази людям", "Steam", "Інше"];
const incomeSources = ["Робота", "Трейдинг", "Боти", "Steam", "Повернення боргу", "Інше"];
const expectedLabels: Array<[ExpectedMoneyStatus, string]> = [
  [ExpectedMoneyStatus.EXPECTED, "Заморожено"],
  [ExpectedMoneyStatus.NEED_TO_COLLECT, "Потрібно забрати"],
  [ExpectedMoneyStatus.IN_PROGRESS, "В процесі"],
  [ExpectedMoneyStatus.RECEIVED, "Повернулось"],
  [ExpectedMoneyStatus.LOST, "Втрачено"],
  [ExpectedMoneyStatus.SCAMMED, "Скам"]
];

async function ensureAccount(userId: string, input: { idSuffix: string; name: string; type: AccountType; currency: "UAH" | "USDT" | "USD"; provider?: string }) {
  const id = `${userId}-${input.idSuffix}`;
  return prisma.account.upsert({
    where: { id },
    update: { name: input.name, type: input.type, currency: input.currency, provider: input.provider || null, isActive: true },
    create: {
      id,
      userId,
      name: input.name,
      type: input.type,
      currency: input.currency,
      provider: input.provider || null,
      initialBalance: "0",
      currentBalance: "0"
    }
  });
}

export async function ensureUserDefaults(userId: string) {
  const existingAccounts = await prisma.account.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
  const [existingCategoryCount, existingIncomeSourceCount] = await Promise.all([
    prisma.category.count({ where: { userId } }),
    prisma.incomeSource.count({ where: { userId } })
  ]);
  const oldBinance = existingAccounts.find((account) => account.name.toLowerCase() === "binance" && account.currency === "USDT");
  const mainWallet =
    oldBinance
      ? await prisma.account.update({
          where: { id: oldBinance.id },
          data: { name: MAIN_WALLET_NAME, provider: null, type: AccountType.CRYPTO_WALLET, isActive: true }
        })
      : existingAccounts.find((account) => account.name === MAIN_WALLET_NAME && account.currency === "USDT") ||
        (await ensureAccount(userId, { idSuffix: "main-wallet", name: MAIN_WALLET_NAME, type: AccountType.CRYPTO_WALLET, currency: "USDT" }));

  const card = existingAccounts.find((account) => account.type === AccountType.BANK_CARD && account.currency === "UAH") ||
    (await ensureAccount(userId, { idSuffix: "main-card", name: "Мейн картка", type: AccountType.BANK_CARD, currency: "UAH", provider: "Bank" }));
  await ensureAccount(userId, { idSuffix: "cash-uah", name: "Cash UAH", type: AccountType.CASH, currency: "UAH", provider: "Cash" });
  await ensureAccount(userId, { idSuffix: "cash-usd", name: "Cash USD", type: AccountType.CASH, currency: "USD", provider: "Cash" });
  await ensureAccount(userId, { idSuffix: "savings-uah", name: SAVINGS_ACCOUNT_NAME, type: AccountType.OTHER, currency: "UAH", provider: "Feelky" });

  await Promise.all([
    ...(existingCategoryCount === 0
      ? categories.map((name, sortOrder) => prisma.category.create({ data: { userId, name, sortOrder } }))
      : []),
    ...(existingIncomeSourceCount === 0
      ? incomeSources.map((name) => prisma.incomeSource.create({ data: { userId, name } }))
      : []),
    ...expectedLabels.map(([status, label], sortOrder) =>
      prisma.expectedStatusDefinition.upsert({
        where: { userId_status: { userId, status } },
        update: { label, sortOrder, isActive: true },
        create: { userId, status, label, sortOrder }
      })
    )
  ]);

  await prisma.settings.upsert({
    where: { userId },
    update: {
      p2pSourceAccountId: mainWallet.id,
      p2pDestinationAccountId: card.id,
      expenseDefaultSourceId: card.id
    },
    create: {
      userId,
      baseDisplayCurrency: "USDT",
      p2pSourceAccountId: mainWallet.id,
      p2pDestinationAccountId: card.id,
      expenseDefaultSourceId: card.id,
      cashExchangePlace: "Cashalot",
      monthlyExpenseLimit: "40000",
      greenMax: "20000",
      yellowMax: "40000",
      theme: "light"
    }
  });
}
