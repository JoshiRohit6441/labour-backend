import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/jwtConfig.js';
import prisma from '../config/database.js';
import { createNotification } from '../controllers/notification/NotificationController.js';

class SocketService {
  constructor(server) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.CLIENT_URL || "http://localhost:8000",
        methods: ["GET", "POST"]
      }
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  setupMiddleware() {
    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          return next(new Error('Authentication error'));
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await prisma.user.findUnique({
          where: { id: decoded.userId },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
            status: true
          }
        });

        if (!user || user.status === 'SUSPENDED') {
          return next(new Error('User not found or suspended'));
        }

        socket.userId = user.id;
        socket.user = user;
        next();
      } catch (error) {
        next(new Error('Authentication error'));
      }
    });
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`User ${socket.user.firstName} ${socket.user.lastName} connected`);

      // Join user to their personal room
      socket.join(`user_${socket.userId}`);

      // Join job-specific rooms
      socket.on('join_job_room', (jobId) => {
        socket.join(`job_${jobId}`);
        console.log(`User ${socket.userId} joined job room ${jobId}`);
      });

      // Leave job-specific rooms
      socket.on('leave_job_room', (jobId) => {
        socket.leave(`job_${jobId}`);
        console.log(`User ${socket.userId} left job room ${jobId}`);
      });

      // Handle location updates
      socket.on('location_update', async (data) => {
        try {
          const { jobId, latitude, longitude, accuracy } = data;

          // Verify user has access to this job
          const job = await prisma.job.findFirst({
            where: {
              id: jobId,
              OR: [
                { userId: socket.userId },
                { contractor: { userId: socket.userId } }
              ]
            }
          });

          if (!job) {
            socket.emit('error', { message: 'Access denied to this job' });
            return;
          }

          // Save location update
          await prisma.locationUpdate.create({
            data: {
              userId: socket.userId,
              jobId,
              latitude,
              longitude,
              accuracy
            }
          });

          // Broadcast location update to job room
          socket.to(`job_${jobId}`).emit('location_update', {
            userId: socket.userId,
            jobId,
            latitude,
            longitude,
            accuracy,
            timestamp: new Date()
          });

        } catch (error) {
          console.error('Location update error:', error);
          socket.emit('error', { message: 'Failed to update location' });
        }
      });

      // Handle chat messages
      socket.on('send_message', async (data) => {
        try {
          const { jobId, message, messageType = 'text', fileUrl } = data;

          // Verify user has access to this job
          const job = await prisma.job.findFirst({
            where: {
              id: jobId,
              OR: [
                { userId: socket.userId },
                { contractor: { userId: socket.userId } }
              ]
            },
            include: {
              chatRoom: true
            }
          });

          if (!job || !job.chatRoom) {
            socket.emit('error', { message: 'Access denied to this job chat' });
            return;
          }

          // Save message to database
          const chatMessage = await prisma.chatMessage.create({
            data: {
              chatRoomId: job.chatRoom.id,
              senderId: socket.userId,
              message,
              messageType,
              fileUrl
            },
            include: {
              sender: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  role: true
                }
              }
            }
          });

          // Broadcast message to job room
          this.io.to(`job_${jobId}`).emit('new_message', chatMessage);

        } catch (error) {
          console.error('Chat message error:', error);
          socket.emit('error', { message: 'Failed to send message' });
        }
      });

      // Handle typing indicators
      socket.on('typing_start', (data) => {
        const { jobId } = data;
        socket.to(`job_${jobId}`).emit('user_typing', {
          userId: socket.userId,
          userName: `${socket.user.firstName} ${socket.user.lastName}`,
          isTyping: true
        });
      });

      socket.on('typing_stop', (data) => {
        const { jobId } = data;
        socket.to(`job_${jobId}`).emit('user_typing', {
          userId: socket.userId,
          userName: `${socket.user.firstName} ${socket.user.lastName}`,
          isTyping: false
        });
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        console.log(`User ${socket.user.firstName} ${socket.user.lastName} disconnected`);
      });
    });
  }

  // Method to send notifications to specific users
  async sendNotificationToUser(userId, type, title, message, data = null) {
    try {
      // Create notification in database
      const notification = await createNotification(userId, type, title, message, data);

      // Send real-time notification
      this.io.to(`user_${userId}`).emit('notification', {
        id: notification.id,
        type,
        title,
        message,
        data,
        sentAt: notification.sentAt
      });

      return notification;
    } catch (error) {
      console.error('Failed to send notification:', error);
      return null;
    }
  }

  // Method to send notifications to multiple users
  async sendNotificationToUsers(userIds, type, title, message, data = null) {
    try {
      const notifications = [];

      for (const userId of userIds) {
        const notification = await this.sendNotificationToUser(userId, type, title, message, data);
        if (notification) {
          notifications.push(notification);
        }
      }

      return notifications;
    } catch (error) {
      console.error('Failed to send bulk notifications:', error);
      return [];
    }
  }

  // Method to broadcast job updates
  async broadcastJobUpdate(jobId, updateType, data) {
    try {
      this.io.to(`job_${jobId}`).emit('job_update', {
        jobId,
        updateType,
        data,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Failed to broadcast job update:', error);
    }
  }

  // Method to get connected users count
  getConnectedUsersCount() {
    return this.io.engine.clientsCount;
  }

  // Method to get connected users in a room
  getRoomUsersCount(roomName) {
    const room = this.io.sockets.adapter.rooms.get(roomName);
    return room ? room.size : 0;
  }
}

export default SocketService;
