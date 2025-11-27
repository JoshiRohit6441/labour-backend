import { Worker } from 'bullmq';
import prisma from '../config/database.js';
import 'dotenv/config';

const createJobExpirationWorker = (app) => {
  const worker = new Worker(
    'job-expiration-queue',
    async (job) => {
      const { jobId } = job.data;

      const existingJob = await prisma.job.findUnique({
        where: { id: jobId },
      });

      if (existingJob && existingJob.status === 'PENDING') {
        await prisma.job.update({
          where: { id: jobId },
          data: { status: 'EXPIRED' },
        });

        // Notify user
        if (socketService) {
          if (socketService.sendNotificationToUsers) {
            await socketService.sendNotificationToUsers(
              [existingJob.userId],
              'JOB_EXPIRED',
              'Job Expired',
              `Your job "${existingJob.title}" has expired as no contractors were available.`,
              { jobId: existingJob.id }
            );
          }
          socketService.io.to(`user_${existingJob.userId}`).emit('job_expired', {
            jobId: existingJob.id,
            message: `Your job "${existingJob.title}" has expired.`,
          });
        }
      }
    },
    {
      connection: {
        // host: process.env.REDIS_HOST,
        // port: process.env.REDIS_PORT,
        url: process.env.REDIS_URL
      },
    }
  );

  return worker;
};

export default createJobExpirationWorker;

