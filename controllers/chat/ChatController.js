
import prisma from '../../config/database.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import handleResponse from '../../utils/handleResponse.js';

class ChatController {
  static initiateChat = asyncHandler(async (req, res) => {
    const { jobId, contractorId } = req.body;
    const userId = req.user.id;

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) {
      return handleResponse(404, 'Job not found', null, res);
    }

    if (job.userId !== userId) {
      return handleResponse(403, 'You are not authorized to initiate a chat for this job', null, res);
    }

    const contractor = await prisma.contractor.findUnique({ where: { id: contractorId } });
    if (!contractor) {
      return handleResponse(404, 'Contractor not found', null, res);
    }

    // Check if a chat already exists
    const existingChat = await prisma.chatMessage.findFirst({
      where: {
        jobId,
        OR: [
          { senderId: userId, receiverId: contractor.userId },
          { senderId: contractor.userId, receiverId: userId },
        ],
      },
    });

    if (existingChat) {
      return handleResponse(200, 'Chat already initiated', { chatId: existingChat.id }, res);
    }

    const chatMessage = await prisma.chatMessage.create({
      data: {
        jobId,
        senderId: userId,
        receiverId: contractor.userId,
        message: `Chat initiated for job: ${job.title}`,
      },
    });

    return handleResponse(201, 'Chat initiated successfully', { chatMessage }, res);
  });

  static sendMessage = asyncHandler(async (req, res) => {
    const { jobId, receiverId, message } = req.body;
    const senderId = req.user.id;

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) {
      return handleResponse(404, 'Job not found', null, res);
    }

    const chatMessage = await prisma.chatMessage.create({
      data: {
        jobId,
        senderId,
        receiverId,
        message,
      },
    });

    // Notify the receiver
    const socketService = req.app.get('socketService');
    if (socketService && socketService.sendNotificationToUser) {
      await socketService.sendNotificationToUser(
        receiverId,
        'NEW_MESSAGE',
        'You have a new message',
        message,
        { jobId, senderId }
      );
    }

    return handleResponse(201, 'Message sent successfully', { chatMessage }, res);
  });

  static getChatMessages = asyncHandler(async (req, res) => {
    const { jobId, contractorId } = req.params;
    const userId = req.user.id;

    const contractor = await prisma.contractor.findUnique({ where: { id: contractorId } });
    if (!contractor) {
      return handleResponse(404, 'Contractor not found', null, res);
    }

    const messages = await prisma.chatMessage.findMany({
      where: {
        jobId,
        OR: [
          { senderId: userId, receiverId: contractor.userId },
          { senderId: contractor.userId, receiverId: userId },
        ],
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return handleResponse(200, 'Chat messages fetched successfully', { messages }, res);
  });
}

export default ChatController;
