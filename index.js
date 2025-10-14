import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer } from 'http';

// Import routes
import userRoutes from './routes/UserRoutes.js';
import contractorRoutes from './routes/ContractorRoutes.js';
import adminRoutes from './routes/AdminRoutes.js';

// Import middleware
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { generalLimiter } from './middleware/rateLimiter.js';

// Import services
import SocketService from './services/socketService.js';

dotenv.config();

const app = express();
const server = createServer(app);

// Initialize Socket.io
const socketService = new SocketService(server);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:3000",
  credentials: true
}));

// Rate limiting
app.use(generalLimiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API routes
app.use('/api/user', userRoutes);
app.use('/api/contractor', contractorRoutes);
app.use('/api/admin', adminRoutes);

app.use("/", (req, resp) => {
  return resp.json({ message: "working properly" }).status(200)
})

// 404 handler
app.use(notFound);

// Error handler
app.use(errorHandler);

// Make socket service available globally
app.set('socketService', socketService);

const port = process.env.PORT || 3000;

server.listen(port, () => {
  console.log(`🚀 Server is running on port ${port}`);
  console.log(`📱 Socket.io server is running`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Process terminated');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  server.close(() => {
    console.log('Process terminated');
  });
});