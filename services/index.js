import { initializeScheduledJobs } from './jobScheduler.js';
import prisma from '../config/database.js';

let connected = false;
let retries = 0;
const maxRetries = 5;

const connectWithRetry = async () => {
  while (retries < maxRetries && !connected) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      connected = true;
      console.log('[Services] Database connected, initializing scheduled jobs');
      await initializeScheduledJobs();
      return;
    } catch (error) {
      retries++;
      console.error(`[Services] Database connection failed. Retry ${retries}/${maxRetries}...`, error);
      if (retries < maxRetries) {
        await new Promise(res => setTimeout(res, 5000));
      } else {
        console.error('[Services] Could not connect to the database after several retries.');
        process.exit(1);
      }
    }
  }
};

export const initializeServices = async () => {
  if (!connected) {
    await connectWithRetry();
  }
};

process.on('beforeExit', async () => {
  if (connected) {
    await prisma.$disconnect();
    console.log('[Prisma] Disconnected on app exit');
  }
});
