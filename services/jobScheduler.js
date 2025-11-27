import cron from 'node-cron';
import prisma from '../config/database.js';
import { getSocketService } from './socketService.js';

const scheduleJob = (job) => {
  const scheduledTime = new Date(job.scheduledStartDate);
  const cronTime = `${scheduledTime.getMinutes()} ${scheduledTime.getHours()} ${scheduledTime.getDate()} ${scheduledTime.getMonth() + 1} *`;

  cron.schedule(cronTime, async () => {
    await prisma.job.update({
      where: { id: job.id },
      data: { status: 'IN_PROGRESS' },
    });

    const socketService = getSocketService();
    if (socketService) {
      // Notify user
      socketService.sendNotificationToUsers(
        [job.userId],
        'JOB_STARTED',
        'Your scheduled job has started',
        `Your job "${job.title}" has started.`,
        { jobId: job.id }
      );

      // Notify contractor
      if (job.contractorId) {
        const contractorUser = await prisma.user.findFirst({
          where: { contractor: { id: job.contractorId } },
        });
        if (contractorUser) {
          socketService.sendNotificationToUsers(
            [contractorUser.id],
            'JOB_STARTED',
            'A scheduled job has started',
            `Your job "${job.title}" has started.`,
            { jobId: job.id }
          );
        }
      }
    }
  });
};

export const scheduleNewJob = (job) => {
  if (job.jobType === 'SCHEDULED' && job.scheduledStartDate) {
    scheduleJob(job);
  }
};

export const initializeScheduledJobs = async () => {
  const pendingScheduledJobs = await prisma.job.findMany({
    where: {
      jobType: 'SCHEDULED',
      status: 'PENDING',
      scheduledStartDate: {
        gte: new Date(),
      },
    },
  });

  pendingScheduledJobs.forEach(scheduleJob);
};
