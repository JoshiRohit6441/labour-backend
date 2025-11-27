
import prisma from '../../config/database.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import handleResponse from '../../utils/handleResponse.js';

class ChatController {
  static initiateChat = asyncHandler(async (req, res) => {
    const { jobId } = req.body;
    const userId = req.user.id;

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { contractor: true },
    });

    if (!job) {
      return handleResponse(404, 'Job not found', null, res);
    }

    if (job.userId !== userId && job.contractor?.userId !== userId) {
      return handleResponse(403, 'You are not authorized to initiate a chat for this job', null, res);
    }

    let chatRoom = await prisma.chatRoom.findUnique({
      where: { jobId },
    });

    if (chatRoom) {
      return handleResponse(200, 'Chat room already exists', { chatRoom }, res);
    }

    const contractorId = job.contractor?.userId;
    if (!contractorId) {
      return handleResponse(404, 'Contractor not found for this job', null, res);
    }

    chatRoom = await prisma.chatRoom.create({
      data: {
        jobId,
        participants: {
          connect: [{ id: userId }, { id: contractorId }],
        },
      },
    });

    return handleResponse(201, 'Chat room created successfully', { chatRoom }, res);
  });

  static sendMessage = asyncHandler(async (req, res) => {
    const { chatRoomId, message } = req.body;
    const senderId = req.user.id;

    const socketService = req.app.get('socketService');
    if (socketService) {
      await socketService.handleNewMessage(chatRoomId, senderId, message);
    }

    return handleResponse(200, 'Message sent successfully', null, res);
  });

  static getChatMessages = asyncHandler(async (req, res) => {
    const { chatRoomId } = req.params;

    const messages = await prisma.chatMessage.findMany({
      where: {
        chatRoomId,
      },
      orderBy: {
        createdAt: 'asc',
      },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profileImage: true,
          },
        },
      },
    });

    return handleResponse(200, 'Chat messages fetched successfully', { messages }, res);
  });
}

export default ChatController;
