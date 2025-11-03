import express from 'express';
import {
  validatePagination,
  validateJobCreation,
  validatePayment,
  validateUserRegistration,
  validateUserLogin,
  validateOTP,
} from '../middleware/validation.js';
import { authLimiter, otpLimiter } from '../middleware/rateLimiter.js';
import NotificationController from '../controllers/user/NotificationController.js';
import PaymentController from '../controllers/user/PaymentController.js';
import WorkerController from '../controllers/worker/WorkerController.js';
import JobController from '../controllers/user/JobController.js';
import ChatController from '../controllers/chat/ChatController.js';
import UserController from '../controllers/user/UserController.js';
import LocationController from '../controllers/LocationController.js';
import { authenticateToken, verifyWorkerToken } from '../middleware/auth.js';
import ImmediateJobController from '../controllers/user/ImmediateJobController.js';
import ScheduledJobController from '../controllers/user/ScheduledJobController.js';
import BiddingJobController from '../controllers/user/BiddingJobController.js';

const router = express.Router();

// Auth routes (public)
router.post('/auth/register', authLimiter, validateUserRegistration, UserController.register);
router.post('/auth/login', authLimiter, validateUserLogin, UserController.login);
router.post('/auth/verify-otp', otpLimiter, validateOTP, UserController.verifyOTP);
router.post('/auth/resend-otp', otpLimiter, UserController.resendOTP);
router.post('/auth/refresh-token', UserController.refreshToken);

// Dashboard routes
router.get('/dashboard/stats', authenticateToken, UserController.getDashboardStats);
router.get('/dashboard/recent-jobs', authenticateToken, UserController.getRecentJobs);

// Webhook route (public)
router.post('/payments/webhook', PaymentController.handleWebhook);

// Worker specific routes (public, or with specific worker token)
router.post('/worker/:jobId/verify-location-code', LocationController.verifyLocationCode);
router.post('/location/share/:jobId', authenticateToken, LocationController.shareLocation);

// All routes below require authentication
router.use(authenticateToken);

// Profile routes
router.get('/profile', UserController.getProfile);
router.put('/profile', UserController.updateProfile);
router.put('/change-password', UserController.changePassword);
router.delete('/account', UserController.deleteAccount);
router.post('/logout', UserController.logout);

// Job routes
router.get('/jobs', validatePagination, JobController.getUserJobs);
router.post('/jobs/immediate', validateJobCreation, ImmediateJobController.createJob);
router.post('/jobs/scheduled', validateJobCreation, ScheduledJobController.createJob);
router.post('/jobs/bidding', validateJobCreation, BiddingJobController.createJob);
router.get('/jobs/:jobId', JobController.getJobDetails);
router.put('/jobs/:jobId', JobController.updateJob);
router.post('/jobs/:jobId/cancel', JobController.cancelJob);
router.delete('/jobs/:jobId', JobController.cancelJob);
router.post('/jobs/:jobId/change-date', JobController.changeStartDate);
router.post('/jobs/:jobId/quotes/:quoteId/accept', JobController.acceptQuote);
router.post('/jobs/:jobId/reviews', JobController.submitReview);
router.get('/jobs/analytics', JobController.getJobAnalytics);
router.get('/jobs/active', JobController.getActiveJob);

// Chat routes
router.get('/chat/rooms', UserController.getChatRooms);
router.get('/chat/rooms/:roomId/messages', validatePagination, ChatController.getChatMessages);
router.post('/chat/initiate', ChatController.initiateChat);
router.post('/chat/send', ChatController.sendMessage);
router.get('/chat/:jobId/:contractorId', ChatController.getChatMessages);

// Location tracking routes
router.get('/jobs/:jobId/locations/latest', JobController.getLatestLocation);
router.put('/jobs/:jobId/tracking', JobController.setTracking);

// Worker specific routes (require verifyWorkerToken)
router.use('/worker', verifyWorkerToken);
router.post('/worker/start-travel', WorkerController.startTravel);
router.post('/worker/update-location', WorkerController.updateLocation);

// Payment routes
router.post('/payments/create-order', validatePayment, PaymentController.createOrder);
router.post('/payments/verify', PaymentController.verifyPayment);
router.get('/payments/history', validatePagination, PaymentController.getPaymentHistory);
router.get('/payments/:paymentId', PaymentController.getPaymentDetails);
router.post('/payments/:paymentId/refund', PaymentController.initiateRefund);
router.get('/payments/analytics', PaymentController.getPaymentAnalytics);
router.get('/payments/methods', PaymentController.getPaymentMethods);
router.post('/payments/methods', PaymentController.addPaymentMethod);
router.delete('/payments/methods/:methodId', PaymentController.removePaymentMethod);

// Notification routes
router.get('/notifications', validatePagination, NotificationController.getNotifications);
router.get('/notifications/unread-count', NotificationController.getUnreadCount);
router.put('/notifications/:notificationId/read', NotificationController.markAsRead);
router.put('/notifications/mark-all-read', NotificationController.markAllAsRead);
router.delete('/notifications/:notificationId', NotificationController.deleteNotification);
router.get('/notifications/preferences', NotificationController.getNotificationPreferences);
router.put('/notifications/preferences', NotificationController.updateNotificationPreferences);
router.get('/notifications/analytics', NotificationController.getNotificationAnalytics);

export default router;