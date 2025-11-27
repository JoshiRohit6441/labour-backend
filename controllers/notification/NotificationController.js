import prisma from '../../config/database.js';
import { notificationQueue } from '../../config/queue.js';

export async function createNotification(userId, type, title, message, data = null) {
  const notification = await prisma.notification.create({
    data: {
      userId,
      type,
      title,
      message,
      data,
    },
  });

  await notificationQueue.add('send-notification', {
    type: 'push',
    data: {
      userId,
      title,
      message,
      data,
    },
  });

  return notification;
}

export async function sendBulkNotifications(userIds, type, title, message, data = null) {
  const notifications = await Promise.all(
    userIds.map((userId) =>
      prisma.notification.create({
        data: {
          userId,
          type,
          title,
          message,
          data
        }
      })
    )
  );

  return notifications;
}

export const subscribe = async (req, res) => {
  const { subscription } = req.body;
  const userId = req.user.id;

  await prisma.pushSubscription.create({
    data: {
      userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
  });

  res.status(201).json({ message: 'Subscribed successfully' });
};


