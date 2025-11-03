
import express from 'express';
import JobController from '../../controllers/contractor/JobController.js';
import { authenticateToken, requireRole } from '../../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken, requireRole(['CONTRACTOR']));

router.get('/', JobController.getContractorJobs);
router.get('/nearby', JobController.getNearbyJobs);
router.get('/analytics', JobController.getJobAnalytics);
router.get('/active', JobController.getActiveJob);
router.get('/:jobId', JobController.getJobDetails);
router.post('/:jobId/claim', JobController.claimJob);
router.post('/:jobId/cancel', JobController.cancelJob);
router.post('/:jobId/start', JobController.startJob);
router.post('/:jobId/complete', JobController.completeJob);
router.post('/:jobId/assign-workers', JobController.assignWorkers);
router.post('/:jobId/quotes', JobController.submitQuote);
router.put('/:jobId/quotes/:quoteId', JobController.updateQuote);
router.delete('/:jobId/quotes/:quoteId', JobController.cancelQuote);
router.post('/:jobId/quotes/:quoteId/request-advance', JobController.requestAdvance);
router.post('/:jobId/share-location', JobController.shareLocation);

export default router;
