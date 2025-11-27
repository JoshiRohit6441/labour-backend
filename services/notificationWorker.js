import { Worker } from 'bullmq';
import prisma from '../config/database.js';
import webpush from '../config/webPushConfig.js';
import 'dotenv/config';

const createNotificationWorker = (app) => {
  const worker = new Worker(
    'notification-queue',
    async (job) => {
      const { type, data } = job.data;

      if (type === 'push') {
        const { userId, title, message, data: notificationData } = data;

        const subscriptions = await prisma.pushSubscription.findMany({
          where: { userId },
        });

        const payload = JSON.stringify({
          title,
          message,
          data: notificationData,
        });

        await Promise.all(
          subscriptions.map((subscription) =>
            webpush.sendNotification(subscription, payload)
          )
        );
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

export default createNotificationWorker;