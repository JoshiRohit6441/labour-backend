import { Worker } from 'bullmq';
import prisma from '../config/database.js';
import 'dotenv/config';

const createJobAcceptanceWorker = (app) => {
  const worker = new Worker(
    'job-acceptance-queue',
    async (job) => {
      const { jobId, quoteId } = job.data;

      const existingJob = await prisma.job.findUnique({
        where: { id: jobId },
      });

      if (existingJob && existingJob.status === 'OFFERED') {
        await prisma.$transaction([
          prisma.job.update({
            where: { id: jobId },
            data: { status: 'QUOTED', contractorId: null },
          }),
          prisma.quote.update({
            where: { id: quoteId },
            data: { isAccepted: false },
          }),
        ]);

        const socketService = app.get('socketService');
        if (socketService && socketService.sendNotificationToUser) {
          await socketService.sendNotificationToUser(
            existingJob.userId,
            'OFFER_EXPIRED',
            'Offer Expired',
            `Your offer to a contractor for the job "${existingJob.title}" has expired as they did not accept it in time.`,
            { jobId: existingJob.id }
          );
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

export default createJobAcceptanceWorker;
