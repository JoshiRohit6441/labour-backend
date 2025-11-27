-- AlterTable
ALTER TABLE "_ChatRoomParticipants" ADD CONSTRAINT "_ChatRoomParticipants_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "public"."_ChatRoomParticipants_AB_unique";

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "contractorId" TEXT;
