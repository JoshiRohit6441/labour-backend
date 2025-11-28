import prisma from '../config/database.js';

export const createOrGetChatRoom = async (jobId, userId, contractorUserId) => {
  const chatRoom = await prisma.chatRoom.upsert({
    where: { jobId },
    update: {
      participants: {
        connect: [{ id: userId }, { id: contractorUserId }],
      },
    },
    create: {
      jobId,
      participants: {
        connect: [{ id: userId }, { id: contractorUserId }],
      },
    },
  });
  return chatRoom;
};
