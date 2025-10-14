import prisma from '../../config/database.js';
import { generatePaginationMeta } from '../../utils/helpers.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { sendBulkNotifications } from '../notification/NotificationController.js';

class NotificationController {
  // Get all notifications with admin view
  static getAllNotifications = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, type, isRead, startDate, endDate, search } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {};

    if (type) where.type = type;
    if (isRead !== undefined) where.isRead = isRead === 'true';
    if (startDate && endDate) {
      where.sentAt = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { message: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              role: true
            }
          }
        },
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

  // Get notification analytics
  static getNotificationAnalytics = asyncHandler(async (req, res) => {
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
      notificationsByReadStatus,
      notificationsByUserRole,
      dailyNotificationStats
    ] = await Promise.all([
      // Total notifications
      prisma.notification.count({
        where: dateFilter
      }),
      // Notifications by type
      prisma.notification.groupBy({
        by: ['type'],
        where: dateFilter,
        _count: { type: true }
      }),
      // Notifications by read status
      prisma.notification.groupBy({
        by: ['isRead'],
        where: dateFilter,
        _count: { isRead: true }
      }),
      // Notifications by user role
      prisma.notification.groupBy({
        by: ['userId'],
        where: dateFilter,
        _count: { userId: true }
      }),
      // Daily notification stats
      prisma.$queryRaw`
        SELECT 
          DATE(sent_at) as date,
          COUNT(*) as total_sent,
          COUNT(CASE WHEN is_read = true THEN 1 END) as read_count,
          COUNT(CASE WHEN is_read = false THEN 1 END) as unread_count
        FROM notifications 
        WHERE sent_at BETWEEN ${startDate || '2020-01-01'} AND ${endDate || new Date()}
        GROUP BY DATE(sent_at)
        ORDER BY date DESC
        LIMIT 30
      `
    ]);

    // Get user details for top notification recipients
    const userIds = notificationsByUserRole.slice(0, 10).map(n => n.userId);
    const userDetails = await prisma.user.findMany({
      where: {
        id: { in: userIds }
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true
      }
    });

    const notificationsByUserWithDetails = notificationsByUserRole.map(notification => {
      const user = userDetails.find(u => u.id === notification.userId);
      return {
        ...notification,
        user
      };
    });

    res.json({
      analytics: {
        totalNotifications,
        readRate: notificationsByReadStatus.find(n => n.isRead)?._count || 0 / totalNotifications * 100 || 0
      },
      notificationsByType,
      notificationsByReadStatus,
      topNotificationRecipients: notificationsByUserWithDetails,
      dailyNotificationStats
    });
  });

  // Send notification to specific user
  static sendNotificationToUser = asyncHandler(async (req, res) => {
    const { userId, type, title, message, data } = req.body;
    const adminId = req.user.id;

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true
      }
    });

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'The specified user was not found'
      });
    }

    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        data
      }
    });

    // Log admin action
    await prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'SEND_NOTIFICATION',
        entityType: 'Notification',
        entityId: notification.id,
        newValues: { userId, type, title, message }
      }
    });

    // TODO: Send real-time notification via Socket.io
    // TODO: Send email/SMS if configured

    res.status(201).json({
      message: 'Notification sent successfully',
      notification: {
        ...notification,
        user
      }
    });
  });

  // Send bulk notifications
  static sendBulkNotifications = asyncHandler(async (req, res) => {
    const { userIds, userRoles, type, title, message, data } = req.body;
    const adminId = req.user.id;

    let targetUserIds = [];

    if (userIds && userIds.length > 0) {
      targetUserIds = userIds;
    } else if (userRoles && userRoles.length > 0) {
      const users = await prisma.user.findMany({
        where: {
          role: { in: userRoles }
        },
        select: { id: true }
      });
      targetUserIds = users.map(u => u.id);
    } else {
      return res.status(400).json({
        error: 'Invalid parameters',
        message: 'Either userIds or userRoles must be provided'
      });
    }

    if (targetUserIds.length === 0) {
      return res.status(400).json({
        error: 'No target users',
        message: 'No users found matching the specified criteria'
      });
    }

    const notifications = await sendBulkNotifications(
      targetUserIds,
      type,
      title,
      message,
      data
    );

    // Log admin action
    await prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'SEND_BULK_NOTIFICATIONS',
        entityType: 'Notification',
        newValues: { 
          targetUserIds, 
          userRoles, 
          type, 
          title, 
          message,
          notificationCount: notifications.length
        }
      }
    });

    res.status(201).json({
      message: `Bulk notifications sent successfully to ${notifications.length} users`,
      notifications
    });
  });

  // Send system-wide announcement
  static sendSystemAnnouncement = asyncHandler(async (req, res) => {
    const { title, message, targetRoles, priority = 'normal' } = req.body;
    const adminId = req.user.id;

    // Get all users based on target roles
    const where = {};
    if (targetRoles && targetRoles.length > 0) {
      where.role = { in: targetRoles };
    }

    const users = await prisma.user.findMany({
      where,
      select: { id: true }
    });

    const userIds = users.map(u => u.id);

    if (userIds.length === 0) {
      return res.status(400).json({
        error: 'No target users',
        message: 'No users found matching the specified criteria'
      });
    }

    const notifications = await sendBulkNotifications(
      userIds,
      'SYSTEM_ALERT',
      title,
      message,
      { priority, announcement: true }
    );

    // Log admin action
    await prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'SEND_SYSTEM_ANNOUNCEMENT',
        entityType: 'Notification',
        newValues: { 
          title, 
          message, 
          targetRoles, 
          priority,
          notificationCount: notifications.length
        }
      }
    });

    res.status(201).json({
      message: `System announcement sent to ${notifications.length} users`,
      announcement: {
        title,
        message,
        targetRoles,
        priority,
        sentTo: notifications.length
      }
    });
  });

  // Delete notification
  static deleteNotification = asyncHandler(async (req, res) => {
    const { notificationId } = req.params;
    const adminId = req.user.id;

    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    if (!notification) {
      return res.status(404).json({
        error: 'Notification not found',
        message: 'The requested notification was not found'
      });
    }

    await prisma.notification.delete({
      where: { id: notificationId }
    });

    // Log admin action
    await prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'DELETE_NOTIFICATION',
        entityType: 'Notification',
        entityId: notificationId,
        oldValues: {
          userId: notification.userId,
          type: notification.type,
          title: notification.title
        }
      }
    });

    res.json({
      message: 'Notification deleted successfully'
    });
  });

  // Mark notification as read (admin override)
  static markNotificationAsRead = asyncHandler(async (req, res) => {
    const { notificationId } = req.params;
    const adminId = req.user.id;

    const notification = await prisma.notification.findUnique({
      where: { id: notificationId }
    });

    if (!notification) {
      return res.status(404).json({
        error: 'Notification not found',
        message: 'The requested notification was not found'
      });
    }

    const updatedNotification = await prisma.notification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: new Date()
      }
    });

    // Log admin action
    await prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'MARK_NOTIFICATION_READ',
        entityType: 'Notification',
        entityId: notificationId,
        oldValues: { isRead: notification.isRead },
        newValues: { isRead: true }
      }
    });

    res.json({
      message: 'Notification marked as read',
      notification: updatedNotification
    });
  });

  // Get notification templates
  static getNotificationTemplates = asyncHandler(async (req, res) => {
    const templates = {
      JOB_REQUEST: {
        title: 'New Job Request',
        message: 'You have received a new job request for {jobTitle}',
        variables: ['jobTitle']
      },
      QUOTE_RECEIVED: {
        title: 'Quote Received',
        message: 'You have received a quote of ₹{amount} for your job "{jobTitle}"',
        variables: ['amount', 'jobTitle']
      },
      JOB_ACCEPTED: {
        title: 'Quote Accepted',
        message: 'Your quote for "{jobTitle}" has been accepted',
        variables: ['jobTitle']
      },
      JOB_STARTED: {
        title: 'Job Started',
        message: 'Your job "{jobTitle}" has been started by the contractor',
        variables: ['jobTitle']
      },
      JOB_COMPLETED: {
        title: 'Job Completed',
        message: 'Your job "{jobTitle}" has been completed successfully',
        variables: ['jobTitle']
      },
      PAYMENT_RECEIVED: {
        title: 'Payment Received',
        message: 'Payment of ₹{amount} has been received for job "{jobTitle}"',
        variables: ['amount', 'jobTitle']
      },
      LOCATION_UPDATE: {
        title: 'Location Update',
        message: 'Worker location has been updated for job "{jobTitle}"',
        variables: ['jobTitle']
      },
      SYSTEM_ALERT: {
        title: 'System Alert',
        message: '{message}',
        variables: ['message']
      }
    };

    res.json({ templates });
  });

  // Get notification reports
  static getNotificationReports = asyncHandler(async (req, res) => {
    const { startDate, endDate, groupBy = 'day' } = req.query;

    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.sentAt = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    let groupByClause;
    switch (groupBy) {
      case 'hour':
        groupByClause = `DATE_TRUNC('hour', sent_at)`;
        break;
      case 'day':
        groupByClause = `DATE(sent_at)`;
        break;
      case 'week':
        groupByClause = `DATE_TRUNC('week', sent_at)`;
        break;
      case 'month':
        groupByClause = `DATE_TRUNC('month', sent_at)`;
        break;
      default:
        groupByClause = `DATE(sent_at)`;
    }

    const reports = await prisma.$queryRaw`
      SELECT 
        ${groupByClause} as period,
        COUNT(*) as total_sent,
        COUNT(CASE WHEN is_read = true THEN 1 END) as read_count,
        COUNT(CASE WHEN is_read = false THEN 1 END) as unread_count,
        ROUND(
          COUNT(CASE WHEN is_read = true THEN 1 END) * 100.0 / COUNT(*), 2
        ) as read_rate
      FROM notifications 
      WHERE sent_at BETWEEN ${startDate || '2020-01-01'} AND ${endDate || new Date()}
      GROUP BY ${groupByClause}
      ORDER BY period DESC
    `;

    res.json({ reports });
  });
}

export default NotificationController;

