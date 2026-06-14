/*
  Warnings:

  - You are about to drop the column `account` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `User` table. All the data in the column will be lost.
  - Added the required column `nickname` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "User_account_deletedAt_idx";

-- DropIndex
DROP INDEX "User_account_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "account",
DROP COLUMN "phone",
ADD COLUMN     "nickname" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "User_nickname_deletedAt_idx" ON "User"("nickname", "deletedAt");
