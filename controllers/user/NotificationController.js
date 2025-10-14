import prisma from '../../config/database.js';
import { generatePaginationMeta } from '../../utils/helpers.js';
import { asyncHandler } from '../../middleware/errorHandler.js';

class NotificationController {
  // Get user's notifications
  static getNotifications = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { page = 1, limit = 20, isRead, type } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = { userId };

    if (isRead !== undefined) where.isRead = isRead === 'true';
    if (type) where.type = type;

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { sentAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.notification.count({ where })
    ]);

    const paginationMeta = generatePaginationMeta(parseInt(page), parseInt(limit), total);

    res.json({
      notifications,
      pagination: paginationMeta
    });
  });

  // Mark notification as read
  static markAsRead = asyncHandler(async (req, res) => {
    const { notificationId } = req.params;
    const userId = req.user.id;

    const notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId
      }
    });

    if (!notification) {
      return res.status(404).json({
        error: 'Notification not found',
        message: 'Notification not found or you do not have permission to update it'
      });
    }

    const updatedNotification = await prisma.notification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: new Date()
      }
    });

    res.json({
      message: 'Notification marked as read',
      notification: updatedNotification
    });
  });

  // Mark all notifications as read
  static markAllAsRead = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    await prisma.notification.updateMany({
      where: {
        userId,
        isRead: false
      },
      data: {
        isRead: true,
        readAt: new Date()
      }
    });

    res.json({
      message: 'All notifications marked as read'
    });
  });

  // Delete notification
  static deleteNotification = asyncHandler(async (req, res) => {
    const { notificationId } = req.params;
    const userId = req.user.id;

    const notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId
      }
    });

    if (!notification) {
      return res.status(404).json({
        error: 'Notification not found',
        message: 'Notification not found or you do not have permission to delete it'
      });
    }

    await prisma.notification.delete({
      where: { id: notificationId }
    });

    res.json({
      message: 'Notification deleted successfully'
    });
  });

  // Get unread notification count
  static getUnreadCount = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const unreadCount = await prisma.notification.count({
      where: {
        userId,
        isRead: false
      }
    });

    res.json({
      unreadCount
    });
  });

  // Get notification preferences
  static getNotificationPreferences = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    // TODO: Implement notification preferences when user preferences table is added
    // For now, return default preferences
    const preferences = {
      emailNotifications: true,
      smsNotifications: true,
      pushNotifications: true,
      jobUpdateNotifications: true,
      quoteNotifications: true,
      paymentNotifications: true,
      systemAnnouncements: true
    };

    res.json({
      preferences
    });
  });

  // Update notification preferences
  static updateNotificationPreferences = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const preferences = req.body;

    // TODO: Save notification preferences when user preferences table is added
    // For now, just return the updated preferences

    res.json({
      message: 'Notification preferences updated successfully',
      preferences
    });
  });

  // Get notification analytics for user
  static getNotificationAnalytics = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.sentAt = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    const [
      totalNotifications,
      notificationsByType,
      readRate,
      dailyStats
    ] = await Promise.all([
      // Total notifications
      prisma.notification.count({
        where: {
          userId,
          ...dateFilter
        }
      }),
      // Notifications by type
      prisma.notification.groupBy({
        by: ['type'],
        where: {
          userId,
          ...dateFilter
        },
        _count: { type: true }
      }),
      // Read rate
      prisma.notification.groupBy({
        by: ['isRead'],
        where: {
          userId,
          ...dateFilter
        },
        _count: { isRead: true }
      }),
      // Daily stats
      prisma.$queryRaw`
        SELECT 
          DATE(sent_at) as date,
          COUNT(*) as total_sent,
          COUNT(CASE WHEN is_read = true THEN 1 END) as read_count,
          COUNT(CASE WHEN is_read = false THEN 1 END) as unread_count
        FROM notifications 
        WHERE user_id = ${userId}
        ${startDate && endDate ? `AND sent_at BETWEEN '${startDate}' AND '${endDate}'` : ''}
        GROUP BY DATE(sent_at)
        ORDER BY date DESC
        LIMIT 30
      `
    ]);

    const readCount = readRate.find(r => r.isRead)?._count || 0;
    const unreadCount = readRate.find(r => !r.isRead)?._count || 0;
    const readRatePercentage = totalNotifications > 0 ? (readCount / totalNotifications) * 100 : 0;

    res.json({
      analytics: {
        totalNotifications,
        readCount,
        unreadCount,
        readRatePercentage: Math.round(readRatePercentage * 100) / 100
      },
      notificationsByType,
      dailyStats
    });
  });
}

export default NotificationController;

