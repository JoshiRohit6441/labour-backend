import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/jwtConfig.js";
import { createNotification } from "../controllers/notification/NotificationController.js";
import prisma from "../config/database.js";
import pushService from "./pushService.js";

let socketServiceInstance = null;

class SocketService {
  constructor(server) {
    if (socketServiceInstance) {
      return socketServiceInstance;
    }

    const allowedOrigins = new Set([
      "http://localhost:5173",
      "http://localhost:8080",
      "http://localhost:3000",
      "https://labour-frontend-gamma.vercel.app"
    ]);

    this.io = new Server(server, {
      cors: {
        origin: (origin, callback) => {
          if (!origin) return callback(null, true);
          if (allowedOrigins.has(origin)) {
            return callback(null, true);
          }
          return callback(new Error("Origin not allowed by CORS: " + origin));
        },
        methods: ["GET", "POST"],
        credentials: true,
      },

      handlePreflightRequest: (req, res) => {
        const origin = req.headers.origin;

        if (origin && allowedOrigins.has(origin)) {
          res.setHeader("Access-Control-Allow-Origin", origin);
          res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
          res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
          res.setHeader("Access-Control-Allow-Credentials", "true");
        }

        res.writeHead(204);
        res.end();
      }
    });

    this.setupRedisAdapter();
    this.setupMiddleware();
    this.setupEventHandlers();

    socketServiceInstance = this;
  }

  setupRedisAdapter() {
    const redisOpts = {
      url: process.env.REDIS_URL,
    };

    if (process.env.REDIS_URL.startsWith("rediss://")) {
      redisOpts.socket = {
        tls: true,
        rejectUnauthorized: false,
      };
    }

    const pubClient = createClient(redisOpts);
    const subClient = pubClient.duplicate();

    pubClient.on("error", (err) =>
      console.error("[Redis PubClient Error]", err?.message || err)
    );

    subClient.on("error", (err) =>
      console.error("[Redis SubClient Error]", err?.message || err)
    );

    pubClient.connect().catch((err) =>
      console.error("[Redis PubClient Connect Failed]", err)
    );

    subClient.connect().catch((err) =>
      console.error("[Redis SubClient Connect Failed]", err)
    );

    this.io.adapter(createAdapter(pubClient, subClient));
  }

  setupMiddleware() {
    this.io.use((socket, next) => {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.split(" ")[1];

      if (!token) {
        return next(new Error("Authentication error"));
      }

      jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
          return next(new Error("Authentication error"));
        }
        socket.user = user;
        next();
      });
    });
  }

  setupEventHandlers() {
    this.io.on("connection", (socket) => {

      socket.on("join_room", (roomId) => socket.join(roomId));
      socket.on("leave_room", (roomId) => socket.leave(roomId));

      socket.on("join_job_room", (jobId) => socket.join(`job_${jobId}`));
      socket.on("leave_job_room", (jobId) => socket.leave(`job_${jobId}`));

      socket.on("send_message", async ({ chatRoomId, message }) => {
        const senderId = socket.user?.id;
        if (!chatRoomId || !senderId) return;
        await this.handleNewMessage(chatRoomId, senderId, message);
      });

      socket.on("disconnect", (reason) => {
      });
    });
  }

  async handleNewMessage(chatRoomId, senderId, message) {
    const chatMessage = await prisma.chatMessage.create({
      data: { chatRoomId, senderId, message },
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

    this.io.to(chatRoomId).emit("new_message", chatMessage);
  }

  async sendNotificationToUser(userId, type, title, message, data) {
    const notification = await createNotification({
      userId,
      type,
      title,
      message,
      data,
    });

    this.io.to(`user_${userId}`).emit("new_notification", notification);

    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { fcmToken: true, pushTokens: true },
      });

      const tokens = [];

      if (user) {
        if (Array.isArray(user.pushTokens)) tokens.push(...user.pushTokens);
        if (user.fcmToken) tokens.push(user.fcmToken);
      }

      if (tokens.length > 0) {
        await pushService.sendToTokens(tokens, {
          title,
          body: message,
          data,
        });
      }
    } catch (err) {
      console.error("[Push Notification Error]", err?.message);
    }
  }

  async sendNotificationToUsers(userIds, type, title, message, data) {
    const notifications = await Promise.all(
      userIds.map((userId) =>
        createNotification({
          userId,
          type,
          title,
          message,
          data,
        })
      )
    );

    notifications.forEach((notification) => {
      this.io
        .to(`user_${notification.userId}`)
        .emit("new_notification", notification);
    });
  }
}

export const getSocketService = () => {
  if (!socketServiceInstance) {
    throw new Error("SocketService not initialized");
  }
  return socketServiceInstance;
};

export default SocketService;
