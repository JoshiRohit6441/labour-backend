import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { validatePagination } from '../middleware/validation.js';
import JobController from '../controllers/contractor/JobController.js';
import LocationController from '../controllers/contractor/LocationController.js';
import NotificationController from '../controllers/contractor/NotificationController.js';
import PaymentController from '../controllers/contractor/PaymentController.js';
import MeetingController from '../controllers/contractor/MeetingController.js';
import ChatController from '../controllers/chat/ChatController.js';

const router = express.Router();

router.use(authenticateToken, requireRole(['CONTRACTOR']));

// Job Routes
router.get('/jobs', JobController.getContractorJobs);
router.get('/jobs/nearby', JobController.getNearbyJobs);
router.get('/jobs/analytics', JobController.getJobAnalytics);
router.get('/jobs/active', JobController.getActiveJob);
router.get('/jobs/:jobId', JobController.getJobDetails);
router.post('/jobs/:jobId/claim', JobController.claimJob);
router.post('/jobs/:jobId/cancel', JobController.cancelJob);
router.post('/jobs/:jobId/start', JobController.startJob);
router.post('/jobs/:jobId/complete', JobController.completeJob);
router.post('/jobs/:jobId/assign-workers', JobController.assignWorkers);
router.post('/jobs/:jobId/quotes', JobController.submitQuote);
router.put('/jobs/:jobId/quotes/:quoteId', JobController.updateQuote);
router.delete('/jobs/:jobId/quotes/:quoteId', JobController.cancelQuote);
router.post('/jobs/:jobId/quotes/:quoteId/request-advance', JobController.requestAdvance);
router.post('/jobs/:jobId/share-location', JobController.shareLocation);

// Location Routes
router.post('/jobs/:jobId/start-travel', LocationController.startTravel);
router.post('/jobs/:jobId/end-travel', LocationController.endTravel);
router.get('/jobs/:jobId/travel-status', LocationController.getTravelStatus);
router.post('/jobs/:jobId/update-location', LocationController.updateLocation);

// Notification Routes
router.get('/notifications', validatePagination, NotificationController.getNotifications);
router.get('/notifications/unread-count', NotificationController.getUnreadCount);
router.put('/notifications/:notificationId/read', NotificationController.markAsRead);
router.put('/notifications/mark-all-read', NotificationController.markAllAsRead);
router.delete('/notifications/:notificationId', NotificationController.deleteNotification);
router.get('/notifications/preferences', NotificationController.getNotificationPreferences);
router.put('/notifications/preferences', NotificationController.updateNotificationPreferences);
router.get('/notifications/analytics', NotificationController.getNotificationAnalytics);

// Payment Routes
router.get('/payments', validatePagination, PaymentController.getPaymentHistory);
router.get('/payments/earnings', PaymentController.getEarningsSummary);
router.get('/payments/payouts/:payoutId', PaymentController.getPayoutDetails);
router.post('/payments/payouts', PaymentController.requestPayout);
router.get('/payments/analytics', PaymentController.getPaymentAnalytics);
router.get('/bank-account', PaymentController.getBankAccountDetails);
router.put('/bank-account', PaymentController.updateBankAccountDetails);

// Meeting Routes
router.post('/meetings', MeetingController.createMeeting);

// Chat Routes
router.post('/chat/initiate', ChatController.initiateChat);
router.post('/chat/send', ChatController.sendMessage);
router.get('/chat/:jobId/:userId', ChatController.getChatMessages);

export default router;