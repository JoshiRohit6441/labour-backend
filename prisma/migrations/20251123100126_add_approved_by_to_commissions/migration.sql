/*
  Warnings:

  - Added the required column `updatedAt` to the `commissions` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('PENDING', 'PROCESSED', 'PAID');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "commissions" ADD COLUMN     "adminNotes" TEXT,
ADD COLUMN     "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedBy" TEXT,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "status" "CommissionStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "contractors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
