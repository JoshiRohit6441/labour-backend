import { Queue } from 'bullmq';
import 'dotenv/config';

// Define a shared, robust connection options object for ioredis (used by BullMQ)
const connectionOptions = {
  url: process.env.REDIS_URL,
  connectTimeout: 30000, // Increased timeout to 30 seconds
  enableReadyCheck: false,
  maxRetriesPerRequest: null,
};

// For rediss:// URLs, ensure TLS options are correctly set for ioredis
if (process.env.REDIS_URL && process.env.REDIS_URL.startsWith('rediss://')) {
  connectionOptions.tls = {
    rejectUnauthorized: false,
  };
}

export const notificationQueue = new Queue('notification-queue', {
  connection: connectionOptions,
});

export const jobExpirationQueue = new Queue('job-expiration-queue', {
  connection: connectionOptions,
});

export const jobAcceptanceQueue = new Queue('job-acceptance-queue', {
  connection: connectionOptions,
});

export default notificationQueue;
