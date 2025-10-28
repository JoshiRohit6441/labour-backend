import express from 'express';
import UserController from '../controllers/user/UserController.js';
import UserPaymentController from '../controllers/user/PaymentController.js';
import UserJobController from '../controllers/user/JobController.js';
import UserNotificationController from '../controllers/user/NotificationController.js';
import { authenticateToken } from '../middleware/auth.js';
import { 
  validatePagination, 
  validateJobCreation, 
  validatePayment,
  validateUserRegistration,
  validateUserLogin,
  validateOTP
} from '../middleware/validation.js';
import { authLimiter, otpLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Auth routes (public)
router.post('/auth/register', authLimiter, validateUserRegistration, UserController.register);
router.post('/auth/login', authLimiter, validateUserLogin, UserController.login);
router.post('/auth/verify-otp', otpLimiter, validateOTP, UserController.verifyOTP);
router.post('/auth/resend-otp', otpLimiter, UserController.resendOTP);
router.post('/auth/refresh-token', UserController.refreshToken);

// Webhook route (public)
router.post('/payments/webhook', UserPaymentController.handleWebhook);

// All routes below require authentication
router.use(authenticateToken);

// Profile routes
router.get('/profile', UserController.getProfile);
router.put('/profile', UserController.updateProfile);
router.put('/change-password', UserController.changePassword);
router.delete('/account', UserController.deleteAccount);
router.post('/logout', UserController.logout);

// Job routes
router.get('/jobs', validatePagination, UserJobController.getUserJobs);
router.post('/jobs', validateJobCreation, UserJobController.createJob);
router.get('/jobs/:jobId', UserJobController.getJobDetails);
router.put('/jobs/:jobId', UserJobController.updateJob);
router.delete('/jobs/:jobId', UserJobController.cancelJob);
router.post('/jobs/:jobId/quotes/:quoteId/accept', UserJobController.acceptQuote);
router.post('/jobs/:jobId/reviews', UserJobController.submitReview);
router.get('/jobs/analytics', UserJobController.getJobAnalytics);

// Location tracking routes
router.get('/jobs/:jobId/locations/latest', UserJobController.getLatestLocation);
router.put('/jobs/:jobId/tracking', UserJobController.setTracking);

// Payment routes
router.post('/payments/create-order', validatePayment, UserPaymentController.createOrder);
router.post('/payments/verify', UserPaymentController.verifyPayment);
router.get('/payments/history', validatePagination, UserPaymentController.getPaymentHistory);
router.get('/payments/:paymentId', UserPaymentController.getPaymentDetails);
router.post('/payments/:paymentId/refund', UserPaymentController.initiateRefund);
router.get('/payments/analytics', UserPaymentController.getPaymentAnalytics);
router.get('/payments/methods', UserPaymentController.getPaymentMethods);
router.post('/payments/methods', UserPaymentController.addPaymentMethod);
router.delete('/payments/methods/:methodId', UserPaymentController.removePaymentMethod);

// Notification routes
router.get('/notifications', validatePagination, UserNotificationController.getNotifications);
router.get('/notifications/unread-count', UserNotificationController.getUnreadCount);
router.put('/notifications/:notificationId/read', UserNotificationController.markAsRead);
router.put('/notifications/mark-all-read', UserNotificationController.markAllAsRead);
router.delete('/notifications/:notificationId', UserNotificationController.deleteNotification);
router.get('/notifications/preferences', UserNotificationController.getNotificationPreferences);
router.put('/notifications/preferences', UserNotificationController.updateNotificationPreferences);
router.get('/notifications/analytics', UserNotificationController.getNotificationAnalytics);

export default router;


