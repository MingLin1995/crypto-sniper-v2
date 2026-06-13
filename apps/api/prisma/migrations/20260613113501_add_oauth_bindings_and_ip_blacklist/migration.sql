/*
  Warnings:

  - You are about to drop the column `lineUserId` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[email]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[googleId]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[telegramId]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[discordId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "lineUserId",
ADD COLUMN     "discordId" TEXT,
ADD COLUMN     "discordWebhook" TEXT,
ADD COLUMN     "googleId" TEXT,
ADD COLUMN     "telegramChatId" TEXT,
ADD COLUMN     "telegramId" TEXT,
ALTER COLUMN "password" DROP NOT NULL;

-- CreateTable
CREATE TABLE "WebSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlacklistedIp" (
    "id" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlacklistedIp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WebSubscription_endpoint_key" ON "WebSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "WebSubscription_userId_idx" ON "WebSubscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BlacklistedIp_ip_key" ON "BlacklistedIp"("ip");

-- CreateIndex
CREATE INDEX "BlacklistedIp_ip_idx" ON "BlacklistedIp"("ip");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramId_key" ON "User"("telegramId");

-- CreateIndex
CREATE UNIQUE INDEX "User_discordId_key" ON "User"("discordId");

-- CreateIndex
CREATE INDEX "User_email_deletedAt_idx" ON "User"("email", "deletedAt");

-- AddForeignKey
ALTER TABLE "WebSubscription" ADD CONSTRAINT "WebSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
