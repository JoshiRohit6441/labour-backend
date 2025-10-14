import express from 'express';
import AdminController from '../controllers/admin/AdminController.js';
import AdminPaymentController from '../controllers/admin/PaymentController.js';
import AdminJobController from '../controllers/admin/JobController.js';
import AdminNotificationController from '../controllers/admin/NotificationController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { validatePagination } from '../middleware/validation.js';

const router = express.Router();

// All routes require admin authentication
router.use(authenticateToken);
router.use(requireRole(['ADMIN', 'STAFF']));

// Dashboard routes
router.get('/dashboard', AdminController.getDashboardStats);

// User management routes
router.get('/users', validatePagination, AdminController.getUsers);
router.get('/users/:userId', AdminController.getUserDetails);
router.put('/users/:userId/status', AdminController.updateUserStatus);

// Contractor management routes
router.get('/contractors', validatePagination, AdminController.getContractors);
router.put('/contractors/:contractorId/status', AdminController.updateContractorStatus);

// Job management routes
router.get('/jobs', validatePagination, AdminJobController.getAllJobs);
router.get('/jobs/analytics', AdminJobController.getJobAnalytics);
router.get('/jobs/:jobId', AdminJobController.getJobDetails);
router.put('/jobs/:jobId/status', AdminJobController.updateJobStatus);
router.delete('/jobs/:jobId', AdminJobController.cancelJob);
router.get('/jobs/disputes', validatePagination, AdminJobController.getJobDisputes);
router.put('/jobs/:jobId/resolve-dispute', AdminJobController.resolveJobDispute);
router.get('/jobs/reports', AdminJobController.getJobReports);

// Payment management routes
router.get('/payments', validatePagination, AdminPaymentController.getAllPayments);
router.get('/payments/analytics', AdminPaymentController.getPaymentAnalytics);
router.put('/payments/:paymentId/approve-refund', AdminPaymentController.approveRefund);
router.put('/payments/:paymentId/reject-refund', AdminPaymentController.rejectRefund);
router.get('/payments/contractor-payouts', validatePagination, AdminPaymentController.getContractorPayouts);
router.post('/payments/contractor-payouts/:contractorId/process', AdminPaymentController.processContractorPayout);
router.get('/payments/disputes', validatePagination, AdminPaymentController.getPaymentDisputes);
router.put('/payments/:paymentId/resolve-dispute', AdminPaymentController.resolvePaymentDispute);

// Notification management routes
router.get('/notifications', validatePagination, AdminNotificationController.getAllNotifications);
router.get('/notifications/analytics', AdminNotificationController.getNotificationAnalytics);
router.post('/notifications/send', AdminNotificationController.sendNotificationToUser);
router.post('/notifications/bulk-send', AdminNotificationController.sendBulkNotifications);
router.post('/notifications/announcement', AdminNotificationController.sendSystemAnnouncement);
router.delete('/notifications/:notificationId', AdminNotificationController.deleteNotification);
router.put('/notifications/:notificationId/read', AdminNotificationController.markNotificationAsRead);
router.get('/notifications/templates', AdminNotificationController.getNotificationTemplates);
router.get('/notifications/reports', AdminNotificationController.getNotificationReports);

// Verification routes
router.get('/verifications', validatePagination, AdminController.getPendingVerifications);
router.put('/verifications/:documentId', AdminController.verifyDocument);

// Reports routes
router.get('/reports', AdminController.getReports);

// Audit logs
router.get('/audit-logs', validatePagination, AdminController.getAuditLogs);

export default router;


