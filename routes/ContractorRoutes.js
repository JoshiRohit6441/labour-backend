import express from 'express';
import ContractorController from '../controllers/contractor/ContractorController.js';
import ContractorPaymentController from '../controllers/contractor/PaymentController.js';
import ContractorJobController from '../controllers/contractor/JobController.js';
import ContractorNotificationController from '../controllers/contractor/NotificationController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { 
  validateContractorProfile, 
  validateWorker, 
  validateRateCard,
  validatePagination,
  validateContractorProfileUpdate,
  validateWorkerUpdate,
  validateRateCardUpdate
} from '../middleware/validation.js';

const router = express.Router();

// All routes require authentication and contractor role
router.use(authenticateToken);
router.use(requireRole(['CONTRACTOR']));

// Profile routes
router.post('/profile', validateContractorProfile, ContractorController.createProfile);
router.get('/profile', ContractorController.getProfile);
router.put('/profile', validateContractorProfileUpdate, ContractorController.updateProfile);

// Worker routes
router.post('/workers', validateWorker, ContractorController.addWorker);
router.get('/workers', validatePagination, ContractorController.getWorkers);
router.put('/workers/:workerId', validateWorkerUpdate, ContractorController.updateWorker);
router.delete('/workers/:workerId', ContractorController.deleteWorker);

// Availability routes
router.post('/workers/:workerId/availability', ContractorController.setWorkerAvailability);
router.get('/workers/:workerId/availability', ContractorController.getWorkerAvailability);

// Rate card routes
router.post('/rate-cards', validateRateCard, ContractorController.createRateCard);
router.get('/rate-cards', ContractorController.getRateCards);
router.put('/rate-cards/:rateCardId', validateRateCardUpdate, ContractorController.updateRateCard);
router.delete('/rate-cards/:rateCardId', ContractorController.deleteRateCard);

// Job routes
router.get('/jobs', validatePagination, ContractorJobController.getContractorJobs);
router.get('/nearby-jobs', validatePagination, ContractorJobController.getNearbyJobs);
router.get('/jobs/analytics', ContractorJobController.getJobAnalytics);
router.post('/jobs/:jobId/quotes', ContractorJobController.submitQuote);
router.put('/jobs/:jobId/quotes/:quoteId', ContractorJobController.updateQuote);
router.delete('/jobs/:jobId/quotes/:quoteId', ContractorJobController.cancelQuote);
router.post('/jobs/:jobId/start', ContractorJobController.startJob);
router.post('/jobs/:jobId/complete', ContractorJobController.completeJob);
router.post('/jobs/:jobId/assign-workers', ContractorJobController.assignWorkers);

// Payment routes
router.get('/payments/history', validatePagination, ContractorPaymentController.getPaymentHistory);
router.get('/payments/earnings', ContractorPaymentController.getEarningsSummary);
router.get('/payments/analytics', ContractorPaymentController.getPaymentAnalytics);
router.get('/payments/payouts/:payoutId', ContractorPaymentController.getPayoutDetails);
router.post('/payments/request-payout', ContractorPaymentController.requestPayout);
router.get('/payments/bank-account', ContractorPaymentController.getBankAccountDetails);
router.put('/payments/bank-account', ContractorPaymentController.updateBankAccountDetails);

// Notification routes
router.get('/notifications', validatePagination, ContractorNotificationController.getNotifications);
router.get('/notifications/unread-count', ContractorNotificationController.getUnreadCount);
router.put('/notifications/:notificationId/read', ContractorNotificationController.markAsRead);
router.put('/notifications/mark-all-read', ContractorNotificationController.markAllAsRead);
router.delete('/notifications/:notificationId', ContractorNotificationController.deleteNotification);
router.get('/notifications/preferences', ContractorNotificationController.getNotificationPreferences);
router.put('/notifications/preferences', ContractorNotificationController.updateNotificationPreferences);
router.get('/notifications/analytics', ContractorNotificationController.getNotificationAnalytics);

export default router;
