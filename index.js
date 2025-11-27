import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer } from 'http';

import userRoutes from './routes/UserRoutes.js';
import contractorRoutes from './routes/ContractorRoutes.js';
import adminRoutes from './routes/AdminRoutes.js';

import { errorHandler, notFound } from './middleware/errorHandler.js';
import { generalLimiter } from './middleware/rateLimiter.js';

import SocketService from './services/socketService.js';
import './services/notificationWorker.js';
import createJobExpirationWorker from './services/jobExpirationWorker.js';
import createJobAcceptanceWorker from './services/jobAcceptanceWorker.js';
import createNotificationWorker from './services/notificationWorker.js';
import prisma from './config/database.js';

import { initializeServices } from './services/index.js';
import { redisReady } from './config/redisConfig.js';

dotenv.config();

await redisReady;

const app = express();
const server = createServer(app);


const socketService = new SocketService(server);
app.set('socketService', socketService);

initializeServices(app).catch(err => {
  console.error('[Server] Failed to initialize services:', err);
});

app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    const allowed = [
      "http://localhost:5173",
      "http://localhost:8080",
      "http://localhost:3000",
      "https://labour-frontend-gamma.vercel.app"
    ];
    if (!origin) return callback(null, true);
    if (allowed.includes(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true
}));

app.use(generalLimiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.use('/api/user', userRoutes);
app.use('/api/contractor', contractorRoutes);
app.use('/api/admin', adminRoutes);

app.use("/", (req, resp) => {
  return resp.json({ message: "working properly" }).status(200)
})

app.use(notFound);

app.use(errorHandler);

const port = process.env.PORT || 3000;

const testDBConnection = async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('[Database] Connection successful');
    return true;
  } catch (error) {
    console.error('[Database] Connection failed:', error.message);
    return false;
  }
};

const startServer = async (retryCount = 0) => {
  const maxRetries = 5;
  
  if (!(await testDBConnection())) {
    if (retryCount < maxRetries) {
      console.log(`[Server] Retrying connection in 5 seconds... (${retryCount + 1}/${maxRetries})`);
      setTimeout(() => startServer(retryCount + 1), 5000);
      return;
    } else {
      console.error('[Server] Failed to connect to database after maximum retries');
      process.exit(1);
    }
  }

  console.log('[Server] Database ready, initializing workers');
  createJobExpirationWorker(app);
  createJobAcceptanceWorker(app);
  createNotificationWorker(app);

  server.listen(port, "0.0.0.0", () => {
    console.log(`[Server] Running on port ${port}`);
  });
};

startServer();

process.on('SIGTERM', async () => {
  console.log('[Server] SIGTERM received, shutting down gracefully');
  await prisma.$disconnect();
  server.close(() => {
    console.log('[Server] Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('[Server] SIGINT received, shutting down gracefully');
  await prisma.$disconnect();
  server.close(() => {
    console.log('[Server] Server closed');
    process.exit(0);
  });
});