import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/jwtConfig.js";
import { createNotification } from "../controllers/notification/NotificationController.js";
import prisma from "../config/database.js";

class SocketService {
  constructor(server) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.CLIENT_URL || "*",
      },
    });

    this.setupRedisAdapter();
    this.setupMiddleware();
    this.setupEventHandlers();
  }

  async setupRedisAdapter() {
    try {
      const redisHost = process.env.REDIS_HOST || "redis";
      const redisPort = process.env.REDIS_PORT || 6379;
      const redisPassword = process.env.REDIS_PASSWORD || "root";

      const redisUrl = `redis://:${redisPassword}@${redisHost}:${redisPort}`;
      console.log("🔗 Connecting Redis Adapter with URL:", redisUrl);

      // ✅ Pub/Sub clients using full URL (auth included)
      const pubClient = createClient({ url: redisUrl, password: redisPassword });
      const subClient = pubClient.duplicate();

      pubClient.on("error", (err) =>
        console.error("❌ Redis PubClient Error:", err)
      );
      subClient.on("error", (err) =>
        console.error("❌ Redis SubClient Error:", err)
      );

      await pubClient.connect();
      await subClient.connect();

      console.log("🔐 Redis adapter connected and authenticated successfully");

      this.io.adapter(createAdapter(pubClient, subClient));
    } catch (err) {
      console.error("❌ Failed to initialize Redis adapter:", err);
    }
  }

  setupMiddleware() {
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) return next(new Error("Authentication error: Missing token"));

        const decoded = jwt.verify(token, JWT_SECRET);

        const user = await prisma.user.findUnique({
          where: { id: decoded.userId },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
            status: true,
          },
        });

        if (!user || user.status === "SUSPENDED") {
          return next(new Error("User not found or suspended"));
        }

        socket.userId = user.id;
        socket.user = user;
        next();
      } catch (error) {
        console.error("🔑 Socket authentication failed:", error);
        next(new Error("Authentication error"));
      }
    });
  }

  setupEventHandlers() {
    this.io.on("connection", (socket) => {
      console.log(
        `✅ User ${socket.user.firstName} ${socket.user.lastName} connected`
      );

      socket.join(`user_${socket.userId}`);

      socket.on("join_job_room", (jobId) => {
        socket.join(`job_${jobId}`);
        console.log(`📦 User ${socket.userId} joined job room ${jobId}`);
      });

      socket.on("join_chat_room", ({ jobId, userId, contractorId }) => {
        const room = `chat_${jobId}_${userId}_${contractorId}`;
        socket.join(room);
        console.log(`💬 User ${socket.userId} joined chat room ${room}`);
      });

      socket.on("leave_job_room", (jobId) => {
        socket.leave(`job_${jobId}`);
        console.log(`🚪 User ${socket.userId} left job room ${jobId}`);
      });

      // 🌍 Location tracking
      socket.on("location_update", async (data) => {
        try {
          const { jobId, latitude, longitude, accuracy } = data;

          const job = await prisma.job.findFirst({
            where: {
              id: jobId,
              OR: [
                { userId: socket.userId },
                { contractor: { userId: socket.userId } },
              ],
            },
          });

          if (!job) {
            socket.emit("error", { message: "Access denied to this job" });
            return;
          }

          if (job.jobType !== "IMMEDIATE") {
            socket.emit("error", {
              message: "Location tracking allowed only for IMMEDIATE jobs",
            });
            return;
          }

          if (!job.isLocationTracking) {
            socket.emit("error", {
              message: "Location tracking is disabled for this job",
            });
            return;
          }

          if (job.status !== "IN_PROGRESS") {
            socket.emit("error", {
              message: "Location updates allowed only when job is IN_PROGRESS",
            });
            return;
          }

          await prisma.locationUpdate.create({
            data: {
              userId: socket.userId,
              jobId,
              latitude: parseFloat(latitude),
              longitude: parseFloat(longitude),
              accuracy,
            },
          });

          socket.to(`job_${jobId}`).emit("location_update", {
            userId: socket.userId,
            jobId,
            latitude,
            longitude,
            accuracy,
            timestamp: new Date(),
          });
        } catch (error) {
          console.error("📍 Location update error:", error);
          socket.emit("error", { message: "Failed to update location" });
        }
      });

      // 💬 Chat messages
      socket.on("send_message", async (data) => {
        try {
          const {
            jobId,
            userId,
            contractorId,
            message,
            messageType = "text",
            fileUrl,
          } = data;

          const job = await prisma.job.findFirst({
            where: {
              id: jobId,
              OR: [
                { userId: socket.userId },
                { contractor: { userId: socket.userId } },
              ],
            },
            include: { chatRoom: true },
          });

          if (!job || !job.chatRoom) {
            socket.emit("error", { message: "Access denied to this job chat" });
            return;
          }

          const chatMessage = await prisma.chatMessage.create({
            data: {
              chatRoomId: job.chatRoom.id,
              senderId: socket.userId,
              message,
              messageType,
              fileUrl,
            },
            include: {
              sender: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  role: true,
                },
              },
            },
          });

          const room =
            userId && contractorId
              ? `chat_${jobId}_${userId}_${contractorId}`
              : `job_${jobId}`;

          this.io.to(room).emit("new_message", chatMessage);
        } catch (error) {
          console.error("💬 Chat message error:", error);
          socket.emit("error", { message: "Failed to send message" });
        }
      });

      socket.on("typing_start", (data) => {
        const { jobId } = data;
        socket.to(`job_${jobId}`).emit("user_typing", {
          userId: socket.userId,
          userName: `${socket.user.firstName} ${socket.user.lastName}`,
          isTyping: true,
        });
      });

      socket.on("typing_stop", (data) => {
        const { jobId } = data;
        socket.to(`job_${jobId}`).emit("user_typing", {
          userId: socket.userId,
          userName: `${socket.user.firstName} ${socket.user.lastName}`,
          isTyping: false,
        });
      });

      socket.on("disconnect", () => {
        console.log(
          `❌ User ${socket.user.firstName} ${socket.user.lastName} disconnected`
        );
      });
    });
  }

  async sendNotificationToUser(userId, type, title, message, data = null) {
    try {
      const notification = await createNotification(
        userId,
        type,
        title,
        message,
        data
      );

      this.io.to(`user_${userId}`).emit("notification", {
        id: notification.id,
        type,
        title,
        message,
        data,
        sentAt: notification.sentAt,
      });

      if (type === "JOB_REQUEST" && data?.jobId) {
        this.io.to(`user_${userId}`).emit("new_job_notification", {
          jobId: data.jobId,
          message: "A new job is available near you!",
        });
      }

      return notification;
    } catch (error) {
      console.error("🔔 Failed to send notification:", error);
      return null;
    }
  }

  async sendNotificationToUsers(userIds, type, title, message, data = null) {
    try {
      const notifications = [];
      for (const userId of userIds) {
        const n = await this.sendNotificationToUser(
          userId,
          type,
          title,
          message,
          data
        );
        if (n) notifications.push(n);
      }
      return notifications;
    } catch (error) {
      console.error("🔔 Failed to send bulk notifications:", error);
      return [];
    }
  }

  async broadcastJobUpdate(jobId, updateType, data) {
    try {
      this.io.to(`job_${jobId}`).emit("job_update", {
        jobId,
        updateType,
        data,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error("🚨 Failed to broadcast job update:", error);
    }
  }

  getConnectedUsersCount() {
    return this.io.engine.clientsCount;
  }

  getRoomUsersCount(roomName) {
    const room = this.io.sockets.adapter.rooms.get(roomName);
    return room ? room.size : 0;
  }
}

export default SocketService;
