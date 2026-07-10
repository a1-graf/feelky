import { AccountType, ExpectedMoneyStatus } from "@prisma/client";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { MAIN_WALLET_NAME, SAVINGS_ACCOUNT_NAME } from "@/lib/user-defaults";

async function main() {
  const email = (process.env.SEED_EMAIL || "admin@example.com").toLowerCase();
  const password = process.env.SEED_PASSWORD || "change-me-please";
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: "Admin",
      passwordHash: await hashPassword(password)
    }
  });

  const accountSeed = [
    { name: MAIN_WALLET_NAME, type: AccountType.CRYPTO_WALLET, currency: "USDT" as const, provider: null, initialBalance: "2500" },
    { name: "Main card", type: AccountType.BANK_CARD, currency: "UAH" as const, provider: "Main bank", initialBalance: "10000" },
    { name: "Cash UAH", type: AccountType.CASH, currency: "UAH" as const, provider: "Cash", initialBalance: "3000" },
    { name: "Cash USD", type: AccountType.CASH, currency: "USD" as const, provider: "Cash", initialBalance: "200" },
    { name: SAVINGS_ACCOUNT_NAME, type: AccountType.OTHER, currency: "UAH" as const, provider: "Feelky", initialBalance: "0" }
  ];

  const accounts = [];
  for (const item of accountSeed) {
    accounts.push(await prisma.account.upsert({
      where: { id: `${user.id}-${item.name.replace(/\s+/g, "-").toLowerCase()}` },
      update: {},
      create: {
        id: `${user.id}-${item.name.replace(/\s+/g, "-").toLowerCase()}`,
        userId: user.id,
        name: item.name,
        type: item.type,
        currency: item.currency,
        provider: item.provider,
        initialBalance: item.initialBalance,
        currentBalance: item.initialBalance
      }
    }));
  }

  const categories = ["Їжа", "Ресторани", "Здоров’я", "Техніка", "Розваги", "Підписки", "Перекази людям", "Steam", "Інше"];
  for (const [index, name] of categories.entries()) {
    await prisma.category.upsert({
      where: { userId_name: { userId: user.id, name } },
      update: { sortOrder: index },
      create: { userId: user.id, name, sortOrder: index }
    });
  }

  const sources = ["Робота", "Трейдинг", "Боти", "Steam", "Повернення боргу", "Інше"];
  for (const name of sources) {
    await prisma.incomeSource.upsert({
      where: { userId_name: { userId: user.id, name } },
      update: {},
      create: { userId: user.id, name }
    });
  }

  const labels: Array<[ExpectedMoneyStatus, string]> = [
    [ExpectedMoneyStatus.EXPECTED, "Заморожено"],
    [ExpectedMoneyStatus.NEED_TO_COLLECT, "Потрібно забрати"],
    [ExpectedMoneyStatus.IN_PROGRESS, "В процесі"],
    [ExpectedMoneyStatus.RECEIVED, "Повернулось"],
    [ExpectedMoneyStatus.LOST, "Втрачено"],
    [ExpectedMoneyStatus.SCAMMED, "Скам"]
  ];
  for (const [index, [status, label]] of labels.entries()) {
    await prisma.expectedStatusDefinition.upsert({
      where: { userId_status: { userId: user.id, status } },
      update: { label, sortOrder: index },
      create: { userId: user.id, status, label, sortOrder: index }
    });
  }

  const mainWallet = accounts.find((account) => account.name === MAIN_WALLET_NAME);
  const card = accounts.find((account) => account.name === "Main card");
  const steamSchemes = ["Сайт → Steam → TM", "Сайт → TM", "Buff → TM"];
  for (const name of steamSchemes) {
    await prisma.steamArbitrageScheme.upsert({
      where: { userId_name: { userId: user.id, name } },
      update: { isActive: true },
      create: { userId: user.id, name }
    });
  }

  await prisma.settings.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      baseDisplayCurrency: "USDT",
      p2pSourceAccountId: mainWallet?.id,
      p2pDestinationAccountId: card?.id,
      expenseDefaultSourceId: card?.id,
      cashExchangePlace: "Cashalot",
      monthlyExpenseLimit: "40000",
      greenMax: "20000",
      yellowMax: "40000",
      theme: "light"
    }
  });

  console.log(`Seed completed for ${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
