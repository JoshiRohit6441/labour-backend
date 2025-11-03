/*
  Warnings:

  - You are about to drop the column `fileUrl` on the `chat_messages` table. All the data in the column will be lost.
  - You are about to drop the column `isRead` on the `chat_messages` table. All the data in the column will be lost.
  - You are about to drop the column `messageType` on the `chat_messages` table. All the data in the column will be lost.
  - You are about to drop the `_ChatRoomUser` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[acceptedQuoteId]` on the table `jobs` will be added. If there are existing duplicate values, this will fail.
  - Changed the type of `paymentType` on the `payments` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MaterialsProvider" AS ENUM ('USER', 'CONTRACTOR');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('ADVANCE', 'FINAL');

-- CreateEnum
CREATE TYPE "MeetingStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED');

-- DropForeignKey
ALTER TABLE "_ChatRoomUser" DROP CONSTRAINT "_ChatRoomUser_A_fkey";

-- DropForeignKey
ALTER TABLE "_ChatRoomUser" DROP CONSTRAINT "_ChatRoomUser_B_fkey";

-- DropForeignKey
ALTER TABLE "chat_rooms" DROP CONSTRAINT "chat_rooms_jobId_fkey";

-- DropIndex
DROP INDEX "location_idx";

-- AlterTable
ALTER TABLE "chat_messages" DROP COLUMN "fileUrl",
DROP COLUMN "isRead",
DROP COLUMN "messageType",
ADD COLUMN     "read" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "jobs" ADD COLUMN     "acceptedQuoteId" TEXT,
ADD COLUMN     "cancellationReason" TEXT,
ADD COLUMN     "cancelledBy" "UserRole",
ADD COLUMN     "detailedDescription" TEXT,
ADD COLUMN     "expectedDays" INTEGER,
ADD COLUMN     "locationSharingCode" TEXT,
ADD COLUMN     "locationSharingCodeExpiresAt" TIMESTAMP(3),
ADD COLUMN     "locationSharingWorkerPhone" TEXT,
ADD COLUMN     "materialsProvidedBy" "MaterialsProvider",
ADD COLUMN     "quoteSubmissionDeadline" TIMESTAMP(3),
ADD COLUMN     "scheduledStartDate" TIMESTAMP(3),
ADD COLUMN     "siteVisitDeadline" TIMESTAMP(3),
ADD COLUMN     "startDate" TIMESTAMP(3),
ADD COLUMN     "workersNeeded" INTEGER;

-- AlterTable
ALTER TABLE "payments" DROP COLUMN "paymentType",
ADD COLUMN     "paymentType" "PaymentType" NOT NULL;

-- AlterTable
ALTER TABLE "quotes" ADD COLUMN     "addOns" JSONB,
ADD COLUMN     "advanceAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "advanceRequested" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "documents" TEXT[],
ADD COLUMN     "meetingScheduledOn" TIMESTAMP(3),
ADD COLUMN     "status" "QuoteStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "totalAmount" DOUBLE PRECISION;

-- DropTable
DROP TABLE "_ChatRoomUser";

-- CreateTable
CREATE TABLE "meetings" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "meetingTime" TIMESTAMP(3) NOT NULL,
    "location" TEXT NOT NULL,
    "status" "MeetingStatus" NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ChatRoomParticipants" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_ChatRoomParticipants_AB_unique" ON "_ChatRoomParticipants"("A", "B");

-- CreateIndex
CREATE INDEX "_ChatRoomParticipants_B_index" ON "_ChatRoomParticipants"("B");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_acceptedQuoteId_key" ON "jobs"("acceptedQuoteId");

-- CreateIndex
CREATE INDEX "location_idx" ON "jobs"("latitude", "longitude");

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_acceptedQuoteId_fkey" FOREIGN KEY ("acceptedQuoteId") REFERENCES "quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "contractors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_rooms" ADD CONSTRAINT "chat_rooms_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ChatRoomParticipants" ADD CONSTRAINT "_ChatRoomParticipants_A_fkey" FOREIGN KEY ("A") REFERENCES "chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ChatRoomParticipants" ADD CONSTRAINT "_ChatRoomParticipants_B_fkey" FOREIGN KEY ("B") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
