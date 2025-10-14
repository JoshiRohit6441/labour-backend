import prisma from '../../config/database.js';

export async function createNotification(userId, type, title, message, data = null) {
  const notification = await prisma.notification.create({
    data: {
      userId,
      type,
      title,
      message,
      data
    }
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


