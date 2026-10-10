-- AlterTable
ALTER TABLE "ExpectedMoney" ADD COLUMN     "sourceAccountId" TEXT;

-- AddForeignKey
ALTER TABLE "ExpectedMoney" ADD CONSTRAINT "ExpectedMoney_sourceAccountId_fkey" FOREIGN KEY ("sourceAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

